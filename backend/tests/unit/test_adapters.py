"""
backend/tests/unit/test_adapters.py

Unit tests for historical traffic data ingestion adapters (CSV and JSON),
data quality reporting, outlier rejection, deduplication, and live provider status.
"""
import io
import json
import pytest
from datetime import datetime, timezone
from backend.data.adapters import (
    HistoricalCsvAdapter,
    HistoricalJsonAdapter,
    LiveTrafficRegistry,
    TomTomTrafficProvider,
    GoogleMapsTrafficProvider,
    ProviderStatus,
)


def test_csv_adapter_valid_data():
    adapter = HistoricalCsvAdapter()
    csv_content = """timestamp,edge_id,speed_kmh,volume_veh_per_hr,occupancy_pct
2024-01-15T08:00:00+05:30,edge_1,35.5,1200,0.45
2024-01-15T08:15:00+05:30,edge_1,32.0,1350,0.52
2024-01-15T09:00:00+05:30,edge_2,48.0,800,0.25
"""
    dataset = adapter.parse(csv_content, source_name="test_feed")

    assert dataset.source_name == "test_feed"
    assert len(dataset.observations) == 3
    assert dataset.quality_report.total_rows == 3
    assert dataset.quality_report.valid_rows == 3
    assert dataset.quality_report.invalid_rows == 0
    assert dataset.quality_report.duplicate_rows == 0
    assert dataset.quality_report.completeness_pct == 100.0

    # Hourly profiles
    assert 8 in dataset.hourly_profiles
    assert dataset.hourly_profiles[8].sample_count == 2
    assert dataset.hourly_profiles[8].avg_speed_kmh == pytest.approx(33.75, 0.01)

    # Edge aggregates
    assert "edge_1" in dataset.edge_mean_speeds
    assert dataset.edge_mean_speeds["edge_1"] == pytest.approx(33.75, 0.01)


def test_csv_adapter_outliers_and_duplicates():
    adapter = HistoricalCsvAdapter()
    csv_content = """timestamp,edge_id,speed_kmh,volume_veh_per_hr,occupancy_pct
2024-01-15T08:00:00Z,edge_1,35.0,1000,0.30
2024-01-15T08:00:00Z,edge_1,35.0,1000,0.30
2024-01-15T08:15:00Z,edge_1,250.0,1000,0.30
2024-01-15T08:30:00Z,edge_1,-10.0,1000,0.30
2024-01-15T08:45:00Z,edge_1,40.0,-50,0.30
2024-01-15T09:00:00Z,edge_1,45.0,800,1.5
"""
    dataset = adapter.parse(csv_content)
    qr = dataset.quality_report

    assert qr.total_rows == 6
    assert qr.valid_rows == 1  # only first row is valid
    assert qr.duplicate_rows == 1  # 2nd row is identical duplicate
    assert qr.speed_outliers_count == 2  # 250.0 km/h and -10.0 km/h outliers
    assert qr.invalid_rows == 4  # 250 speed, -10 speed, -50 volume, 1.5 occupancy
    assert len(qr.issues) > 0


def test_csv_adapter_unmapped_edges():
    adapter = HistoricalCsvAdapter()
    csv_content = """timestamp,edge_id,speed_kmh,volume_veh_per_hr
2024-01-15T10:00:00Z,valid_edge_a,40.0,500
2024-01-15T10:15:00Z,unknown_phantom_road,35.0,600
"""
    known_network_edges = {"valid_edge_a", "valid_edge_b"}
    dataset = adapter.parse(csv_content, known_network_edges=known_network_edges)

    assert dataset.quality_report.unmapped_edges_count == 1
    assert dataset.quality_report.valid_rows == 2  # observations are recorded but unmapped count flagged


def test_csv_adapter_missing_headers():
    adapter = HistoricalCsvAdapter()
    dataset = adapter.parse("some_random_col,another_col\n1,2\n")
    assert dataset.quality_report.total_rows == 0
    assert len(dataset.quality_report.issues) == 1
    assert "Missing required columns" in dataset.quality_report.issues[0]


def test_json_adapter_valid_payload():
    adapter = HistoricalJsonAdapter()
    data = {
        "source": "sensor_loop_jaipur",
        "observations": [
            {
                "timestamp": "2024-01-15T11:00:00+05:30",
                "edge_id": "mi_road_01",
                "speed_kmh": 42.0,
                "volume_veh_per_hr": 1100,
                "occupancy_pct": 0.4,
            },
            {
                "timestamp": "2024-01-15T11:30:00+05:30",
                "edge_id": "mi_road_01",
                "speed_kmh": 38.0,
                "volume_veh_per_hr": 1300,
                "occupancy_pct": 0.5,
            },
        ],
    }
    dataset = adapter.parse(json.dumps(data))

    assert dataset.source_name == "sensor_loop_jaipur"
    assert len(dataset.observations) == 2
    assert dataset.quality_report.valid_rows == 2
    assert dataset.quality_report.completeness_pct == 100.0
    assert 11 in dataset.hourly_profiles
    assert dataset.hourly_profiles[11].avg_speed_kmh == pytest.approx(40.0)


def test_json_adapter_malformed():
    adapter = HistoricalJsonAdapter()
    dataset = adapter.parse("not valid json at all")
    assert dataset.quality_report.total_rows == 0
    assert "Invalid JSON" in dataset.quality_report.issues[0]


def test_live_traffic_registry_default_state(monkeypatch):
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_MAPS_API_KEY", raising=False)

    registry = LiveTrafficRegistry()
    statuses = registry.get_all_statuses()

    assert len(statuses) == 2
    for s in statuses:
        assert s.status == ProviderStatus.CREDENTIALS_MISSING
        assert s.is_live is False
        assert "not configured" in s.message

    assert registry.is_any_live() is False


def test_live_traffic_registry_with_key(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", "dummy_test_key_12345")
    registry = LiveTrafficRegistry()
    tomtom = registry.providers["tomtom"]
    status_info = tomtom.check_status()

    assert status_info.status == ProviderStatus.AVAILABLE
    assert status_info.is_live is True

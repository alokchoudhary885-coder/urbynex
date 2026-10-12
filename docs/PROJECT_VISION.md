# Urbynex — Project Vision

**Tagline:** Simulate Cities. Predict Possibilities.

## Purpose

Urbynex is a professional, interactive decision-support platform for urban traffic experimentation. It allows planners, researchers, and analysts to explore real road networks, simulate traffic under different conditions, and interpret results using AI — without requiring changes to real infrastructure.

## Core Value Proposition

Traffic planning decisions are expensive to test in the real world. Urbynex provides a virtual environment where users can:

1. Explore validated city road networks
2. Define a baseline traffic scenario
3. Apply a controlled intervention (closure, demand increase, signal change, incident)
4. Run a genuine traffic simulation
5. Compare the outcome against the baseline
6. Ask an AI copilot to explain the results using actual simulation data and planning documents

## Target Users

- Urban planners exploring infrastructure options
- Traffic engineers studying corridor performance
- Researchers modelling demand changes
- Students learning about traffic simulation concepts

## Non-Goals

- Urbynex is not a real-time traffic monitoring system
- Simulation results are not guaranteed predictions of real-world behavior
- The platform does not replace professional traffic engineering review
- It does not provide emergency routing or navigation advice

## Key Differentiators

| Feature | Urbynex Approach |
|---|---|
| Simulation | Genuine execution, not random number generation |
| AI Explanations | Grounded in actual simulation metrics and documents |
| Data Transparency | Clear labels: SYNTHETIC, HISTORICAL, SIMULATED, AI EXPLANATION |
| Honesty | Empty states, honest error messages, no fake live data |
| Reproducibility | Saved seed, config, network version for every run |

## Supported Cities (Planned)

| City | Status |
|---|---|
| Jaipur (MI Road / JLN Marg corridor) | Phase 1 target |
| Delhi (Connaught Place / Barakhamba corridor) | Phase 4 target |

## Data Categories

- **Observed:** Retrieved from a real traffic provider
- **Historical:** Imported from a past measurement period
- **Synthetic:** Generated for controlled experiments
- **Simulated:** Produced by executing the traffic simulator
- **AI Interpretation:** Explanatory text generated from available evidence

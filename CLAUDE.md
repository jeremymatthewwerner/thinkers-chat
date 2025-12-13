# Thinkers Chat

A real-time, multi-party chat simulator where users engage in group conversations with AI-simulated historical and contemporary thinkers.

## Project Overview

This web application creates an immersive chat experience where users can discuss topics with simulated versions of famous philosophers, scientists, writers, and other notable figures. The simulation aims to authentically replicate each thinker's communication style, intellectual positions, and personality.

## Tech Stack

- **Frontend**: (TBD - considering React/Next.js or SvelteKit)
- **Backend**: (TBD - considering Node.js/Python)
- **LLM Integration**: Claude API for agent simulation
- **Real-time Communication**: WebSockets for live chat experience

## Key Concepts

- **Thinker Agents**: LLM-based agents that simulate specific historical/contemporary figures
- **Chat Room**: A conversation space with one user and multiple thinker agents
- **Concurrent Responses**: Multiple agents may "type" and respond simultaneously
- **Topic Context**: Conversations are grounded in a user-specified topic

## Development Commands

(To be added as the project develops)

## Architecture Notes

- Each thinker agent runs as an independent process/thread to enable concurrent responses
- Agents should have configurable "personality profiles" with biographical context, writing samples, and known positions
- Response timing should feel natural (varying delays, occasional interruptions/overlaps)

## Code Style

- (To be defined based on chosen tech stack)

## Important Considerations

- Agents should clearly indicate they are simulations, not the actual people
- Handle controversial historical figures and viewpoints responsibly
- Consider rate limiting and cost management for LLM API calls

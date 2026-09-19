# Arch_App Agent Orchestration System

## Structure
```
.agents/
├── orchestrator.md    # Main coordinator
├── developer.md       # Code implementation
├── reviewer.md        # Code review
├── tester.md          # Testing & QA
├── state/
│   ├── orchestrator.json
│   ├── developer.json
│   ├── reviewer.json
│   └── tester.json
├── handoffs/          # Agent-to-agent handoffs
├── plans/             # Task plans
└── reviews/           # Review reports
```

## How It Works
1. **Orchestrator** reads state → delegates to **Developer**
2. **Developer** implements → writes handoff → **Reviewer**
3. **Reviewer** reviews → writes handoff → **Tester**
4. **Tester** tests → writes handoff → **Deployer**
5. **Deployer** deploys → updates state → back to **Orchestrator**

## Key Principles
- Agents do NOT re-read the entire project
- Each agent reads only its state file + handoff
- Handoffs are JSON files in `.agents/handoffs/`
- State files track progress across sessions
- System is portable — copy `.agents/` to any project

## Usage
1. Copy `.agents/` folder to your project
2. Edit `orchestrator.md` with your project details
3. Run orchestrator to start the workflow

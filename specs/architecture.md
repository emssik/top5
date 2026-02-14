# Architektura Top5 — po zmianach API v1

## Ogólny schemat

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS (Electron)                      │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐                               │
│  │  IPC Adapter  │    │ HTTP Adapter │  ← Fastify, 127.0.0.1:15055  │
│  │  (thin)       │    │ (thin)       │  ← Bearer token auth         │
│  └──────┬───────┘    └──────┬───────┘                               │
│         │                   │                                       │
│         └─────────┬─────────┘                                       │
│                   ▼                                                 │
│  ┌─────────────────────────────────┐                                │
│  │        SERVICE LAYER            │                                │
│  │  walidacja + logika biznesowa   │                                │
│  │                                 │                                │
│  │  ┌────────────┐ ┌────────────┐  │                                │
│  │  │ projects   │ │ quick-tasks│  │  ← v1 (przez API + IPC)       │
│  │  └────────────┘ └────────────┘  │                                │
│  │  ┌────────────────────────────┐ │                                │
│  │  │ repeating-tasks            │ │  ← v1 (przez API + IPC)       │
│  │  └────────────────────────────┘ │                                │
│  └──────────────┬──────────────────┘                                │
│                 ▼                                                   │
│  ┌─────────────────────────────────┐                                │
│  │        PERSISTENCE              │                                │
│  │  getData() / setData()          │                                │
│  │  data.yaml + checkins.jsonl     │                                │
│  └─────────────────────────────────┘                                │
│                                                                     │
│  ┌─────────────────────────────────┐                                │
│  │   JESZCZE W store.ts (future)   │                                │
│  │   IPC-only, nie wyekstrahowane  │                                │
│  │                                 │                                │
│  │   • focus check-ins             │                                │
│  │   • config management           │                                │
│  │   • quick notes                 │                                │
│  │   • operation log               │                                │
│  └─────────────────────────────────┘                                │
│                                                                     │
│  ┌─────────────────────────────────┐                                │
│  │   WINDOW CONTROL (IPC-only)     │                                │
│  │   zawsze Electron-specific      │                                │
│  │                                 │                                │
│  │   • focus-window.ts             │                                │
│  │   • quick-add window            │                                │
│  │   • check-in window             │                                │
│  │   • traffic lights, resize      │                                │
│  │   • open-external               │                                │
│  └─────────────────────────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

         ▲                                       ▲
         │ IPC                                   │ HTTP
         │                                       │
┌────────┴────────┐                   ┌──────────┴──────────┐
│    RENDERER      │                   │   EXTERNAL CLIENT   │
│    (Electron UI) │                   │   (curl, skrypty,   │
│                  │                   │    mobile app, CLI)  │
└─────────────────┘                   └─────────────────────┘
```

## Co się zmienia w v1

```
PRZED (monolith):                    PO v1 (service layer):

  IPC handler                          IPC adapter (thin)
  ├─ walidacja                              │
  ├─ logika biznesowa         →        Service function
  ├─ getData/setData                   ├─ walidacja
  └─ notifyAllWindows()                ├─ logika biznesowa
                                       └─ getData/setData
                                            │
                                       HTTP adapter (thin)
                                            │
                                       (ten sam Service)
```

## Shared types

```
src/shared/types.ts          ← jedno źródło prawdy
       │
       ├── src/main/store.ts         (import)
       ├── src/main/service/*.ts     (import)
       ├── src/main/api/routes/*.ts  (import)
       └── src/renderer/types/       (re-export)
```

## Przepływ requestu HTTP

```
curl POST /api/v1/quick-tasks
  │
  ▼
Fastify onRequest hook
  │ Bearer token === apiKey?
  │ NIE → 401 Unauthorized
  │ TAK ↓
  ▼
HTTP route (adapter)
  │ req.body → serwis
  ▼
quickTaskService.saveQuickTask(req.body)
  │ walidacja → błąd? → { error: "..." }
  │ OK → getData(), modyfikacja, setData()
  ▼
adapter
  │ error? → 400 { ok: false, error }
  │ OK    → notifyAllWindows()
  │         201 { ok: true, data }
  ▼
UI odświeża się automatycznie (notifyAllWindows)
```

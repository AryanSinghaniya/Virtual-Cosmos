# GitHub Copilot Instructions for Virtual Cosmos

## Architectural Pattern
- **FastAPI Layer**: Asynchronous REST + WebSocket controllers in `backend/app/api/v1/`.
- **Domain Layer**: Core logic in `backend/app/services/` (`spatial_service.py`, `vector_service.py`, `auth_service.py`, `connection_manager.py`).
- **Data Layer**: Declarative models in `backend/app/models/` and Alembic migrations in `backend/alembic/`.
- **Client Layer**: Zustand state slices in `client/src/store/` and reusable UI components in `client/src/components/`.

## Best Practices
- Keep WebSocket payloads lightweight (send only position deltas `x, y` rather than full objects on tick).
- Ensure error responses adhere to the standard `ResponseEnvelope` JSON format.
- Ensure all JWT Bearer tokens include user claims and are verified using `pyjwt`/`jose`.

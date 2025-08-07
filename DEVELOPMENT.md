# Development Workflow

## Development Setup

The platform supports two different development approaches:

### 1. Production Build (Docker) + Development Frontend

This is the **recommended approach** for active development:

#### Step 1: Start Backend Services
```bash
# Start all backend services (API, DB, Kafka, Elasticsearch) with development configuration
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This will start:
- **NLJ API**: http://localhost:8000/docs (with CORS enabled for localhost:5173)
- **PostgreSQL**: localhost:5432 (exposed for development access)
- **Kafka**: localhost:9092 (exposed for development access)  
- **Elasticsearch**: localhost:9200 (exposed for development access)
- **Kafka UI**: http://localhost:8080 (development tools enabled)
- **Production Frontend**: http://localhost (nginx-served, for production testing)

#### Step 2: Start Development Frontend (in another terminal)
```bash
cd frontend
npm run dev:frontend
```

This will start:
- **Development Frontend**: http://localhost:5173 (with hot reload, connected to Docker backend)

### 2. Full Docker Development (Legacy)

For testing the complete production-like environment:

```bash
# Start production system
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

This serves the built frontend via nginx at http://localhost.

## Development URLs

- **Development Frontend** (Hot Reload): http://localhost:5173
- **Production Frontend** (Docker): http://localhost  
- **API Documentation**: http://localhost:8000/docs
- **Kafka UI**: http://localhost:8080

## Benefits of Recommended Approach

1. **Fast Hot Reload**: Frontend changes are instantly reflected
2. **Full Backend Integration**: Access to real PostgreSQL, Kafka, and Elasticsearch
3. **Production Testing**: Production build still available at http://localhost
4. **Separated Concerns**: Frontend development doesn't require Docker rebuilds
5. **Database Access**: Direct access to all services for debugging

## Environment Variables

The development frontend uses:
- `VITE_API_BASE_URL=http://localhost:8000` (set by `npm run dev:frontend`)
- API automatically configured for CORS with localhost:5173

## Troubleshooting

- **Port Conflicts**: Ensure ports 5173, 8000, 5432, 9092, 9200, 8080 are available
- **Database Connection**: Backend services must be running before starting frontend
- **CORS Issues**: Backend automatically configures CORS for localhost:5173 in development mode
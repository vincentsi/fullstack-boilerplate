# 🐳 Docker Deployment Guide

This guide explains how to deploy the fullstack boilerplate with Docker and Docker Compose.

## 📋 Prerequisites

- Docker 20.10+ installed ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ installed ([Install Docker Compose](https://docs.docker.com/compose/install/))
- Minimum 2GB RAM available
- Ports 3000, 3001, 5432 available (or modify in docker-compose.yml)

## 🚀 Quick Start (Development)

### 1. Environment Configuration

Create a `.env` file at the project root:

```bash
# Copy the template
cp .env.example .env
```

Fill in the required variables:

```env
# JWT Secrets (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=your-secret-min-32-characters
JWT_REFRESH_SECRET=your-refresh-secret-min-32-characters

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Start the Application

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Application is available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
# - Database: localhost:5432
```

### 3. Database Migrations

Migrations run automatically on backend startup. To run manually:

```bash
docker-compose exec backend npx prisma migrate deploy
```

### 4. Stop the Application

```bash
# Stop services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

## 🏭 Production Deployment

### 1. Production Configuration

Create a `.env.production` file:

```env
# Database
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=boilerplate_prod

# JWT Secrets (GENERATE NEW SECRETS!)
JWT_SECRET=<64-char-hex-secret>
JWT_REFRESH_SECRET=<64-char-hex-secret>

# Frontend URL
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Stripe Production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Launch in Production

```bash
# Load environment variables
export $(cat .env.production | xargs)

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Nginx Configuration (Reverse Proxy)

Create `nginx.conf` for reverse proxy:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # API Backend
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

## 🔧 Useful Commands

### Service Management

```bash
# Start a specific service
docker-compose up -d backend

# Restart a service
docker-compose restart backend

# Stop a service
docker-compose stop frontend

# View service logs
docker-compose logs -f backend

# View container stats
docker stats
```

### Database Operations

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U postgres -d boilerplate_dev

# Database backup
docker-compose exec postgres pg_dump -U postgres boilerplate_dev > backup.sql

# Database restore
docker-compose exec -T postgres psql -U postgres boilerplate_dev < backup.sql

# Prisma Studio (GUI)
docker-compose exec backend npx prisma studio
```

### Debugging

```bash
# Interactive shell in backend container
docker-compose exec backend sh

# View processes in container
docker-compose exec backend ps aux

# Inspect service configuration
docker-compose config

# Check health checks
docker-compose ps
```

### Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Complete cleanup (⚠️ DANGEROUS)
docker system prune -a --volumes
```

## 📊 Monitoring and Logs

### Centralized Logging

All service logs are available via:

```bash
# Real-time logs (all services)
docker-compose logs -f

# Logs for specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Since 1 hour ago
docker-compose logs --since 1h backend
```

### Health Checks

Health checks are configured in Dockerfiles:

- **Backend**: `http://localhost:3001/api/health`
- **Frontend**: `http://localhost:3000`
- **PostgreSQL**: `pg_isready`

Check status:

```bash
docker-compose ps
```

## 🔐 Security

### Best Practices

1. **NEVER commit .env** - Secrets must be in environment variables
2. **Generate new JWT secrets** for each environment
3. **Use HTTPS in production** with SSL certificates (Let's Encrypt)
4. **Limit container resources**:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

5. **Scan for vulnerabilities**:

```bash
# Scan images
docker scan boilerplate-backend
docker scan boilerplate-frontend
```

## 🚀 Production Optimizations

### Multi-stage Builds

Dockerfiles already use multi-stage builds for:
- ✅ Reduced image size (≈80% smaller)
- ✅ Separate build and runtime dependencies
- ✅ Improved security (no dev tools in prod)

### Build Cache

Use Docker cache for faster builds:

```bash
# Build with cache
docker-compose build

# Build without cache (clean build)
docker-compose build --no-cache
```

### Docker Registry

Push your images to a registry:

```bash
# Tag images
docker tag boilerplate-backend:latest myregistry.com/boilerplate-backend:v1.0.0
docker tag boilerplate-frontend:latest myregistry.com/boilerplate-frontend:v1.0.0

# Push to registry
docker push myregistry.com/boilerplate-backend:v1.0.0
docker push myregistry.com/boilerplate-frontend:v1.0.0
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using the port
lsof -i :3000
lsof -i :3001
lsof -i :5432

# Kill the process
kill -9 <PID>
```

### Container Won't Start

```bash
# View detailed logs
docker-compose logs backend

# Inspect container
docker inspect boilerplate-backend

# Verify configuration
docker-compose config
```

### Migrations Fail

```bash
# Reset DB (⚠️ data loss)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec backend npx prisma migrate reset
```

### Permission Issues

```bash
# Dockerfiles create non-root users (fastify:1001, nextjs:1001)
# If permission issues, check mounted volumes
ls -la ./apps/backend/dist
```

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- [Prisma with Docker](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
- [Next.js with Docker](https://nextjs.org/docs/deployment#docker-image)

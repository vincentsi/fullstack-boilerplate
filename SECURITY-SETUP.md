# 🔒 Security Setup Guide

## ⚠️ CRITIQUE - Configuration des Secrets

### 1. Générer de Nouveaux Secrets JWT

**IMPORTANT**: Les secrets actuels dans l'ancien `.env` sont COMPROMIS car ils étaient versionnés dans Git. Vous DEVEZ les régénérer.

```bash
# Générer JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Générer JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. Créer le Fichier .env (Backend)

Créez `apps/backend/.env` avec ces nouvelles valeurs :

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/boilerplate_dev"

# Server
PORT=3001
NODE_ENV=development

# JWT Secrets - GÉNÉRER DE NOUVELLES VALEURS (voir commandes ci-dessus)
JWT_SECRET="VOTRE_NOUVEAU_SECRET_ICI"
JWT_REFRESH_SECRET="VOTRE_NOUVEAU_REFRESH_SECRET_ICI"

# Frontend
FRONTEND_URL="http://localhost:3000"

# Stripe (optionnel - requis seulement si vous utilisez les fonctionnalités de paiement)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### 3. Créer le Fichier .env (Frontend)

Créez `apps/frontend/.env.local` :

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 4. Vérifications de Sécurité

✅ **Checklist** :
- [ ] `.env` est dans `.gitignore`
- [ ] Nouveaux secrets JWT générés (différents des anciens)
- [ ] Fichiers `.env` créés localement
- [ ] Fichiers `.env` ne sont PAS commités dans Git
- [ ] `.env.example` est à jour (sans valeurs réelles)

### 5. Pour la Production

**NE JAMAIS** utiliser les mêmes secrets en production qu'en développement.

Générez de nouveaux secrets pour chaque environnement :
- Development (local)
- Staging
- Production

Utilisez un gestionnaire de secrets :
- AWS Secrets Manager
- HashiCorp Vault
- Railway/Vercel Environment Variables
- GitHub Secrets (pour CI/CD)

### 6. Rotation des Secrets

Si vos secrets sont compromis :

1. Générer de nouveaux secrets
2. Mettre à jour les variables d'environnement
3. Redémarrer l'application
4. **IMPORTANT** : Tous les utilisateurs devront se reconnecter (tokens invalides)

---

## 📋 Notes Importantes

- ❌ **NE JAMAIS** commiter `.env` dans Git
- ❌ **NE JAMAIS** partager vos secrets dans Slack/Discord/Email
- ❌ **NE JAMAIS** utiliser les mêmes secrets entre dev/staging/prod
- ✅ Utiliser `.env.example` pour documenter les variables requises (sans valeurs)
- ✅ Utiliser des gestionnaires de secrets en production
- ✅ Faire une rotation régulière des secrets (tous les 90 jours)

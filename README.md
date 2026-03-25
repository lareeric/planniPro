# PlanniPro — Emploi du Temps
**Application web complète : HTML + CSS + JS + PHP + MySQL**

---

## 📁 Structure du projet

```
emploi-du-temps/
├── index.html              ← Page principale (frontend)
├── css/
│   └── style.css           ← Tous les styles
├── js/
│   └── app.js              ← Logique JavaScript (SPA)
├── php/
│   ├── config.php          ← Configuration BDD + fonctions utilitaires
│   ├── auth.php            ← API Authentification (inscription/connexion)
│   ├── evenements.php      ← API CRUD Événements
│   └── categories.php      ← API CRUD Catégories
└── sql/
    └── schema.sql          ← Schéma de la base de données
```

---

## ⚙️ Installation

### 1. Pré-requis
- **Serveur web** : Apache ou Nginx avec PHP 8.1+
- **Base de données** : MySQL 8.0+ ou MariaDB 10.6+
- **Extensions PHP** : `pdo`, `pdo_mysql`, `mbstring`

### 2. Déploiement
```bash
# Copier les fichiers dans votre répertoire web
cp -r emploi-du-temps/ /var/www/html/
# ou dans XAMPP/WAMP :
cp -r emploi-du-temps/ C:/xampp/htdocs/
```

### 3. Base de données
```bash
# Se connecter à MySQL
mysql -u root -p

# Importer le schéma
source /chemin/vers/emploi-du-temps/sql/schema.sql;
# ou via phpMyAdmin : Importer → schema.sql
```

### 4. Configuration
Éditer `php/config.php` :
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'emploi_du_temps');
define('DB_USER', 'votre_user');   // ← à modifier
define('DB_PASS', 'votre_mdp');    // ← à modifier
```

### 5. Permissions (Linux/Apache)
```bash
chown -R www-data:www-data /var/www/html/emploi-du-temps/
chmod -R 755 /var/www/html/emploi-du-temps/
```

### 6. Accès
Ouvrir dans le navigateur :
```
http://localhost/emploi-du-temps/
```

---

## 🔒 Sécurité (production)

Ajouter à la racine un `.htaccess` pour protéger le dossier PHP :
```apache
# Bloquer l'accès direct aux fichiers PHP depuis le navigateur
<FilesMatch "\.php$">
  Require all denied
</FilesMatch>
# Permettre uniquement via le serveur
```

Ou mieux : déplacer le dossier `php/` hors du webroot et ajuster les chemins.

**Recommandations additionnelles :**
- Utiliser HTTPS (Let's Encrypt)
- Ajouter des tokens CSRF
- Limiter les tentatives de connexion (rate limiting)
- Utiliser des variables d'environnement pour les credentials

---

## ✨ Fonctionnalités

| Feature | Description |
|---|---|
| 🗓 Vue Semaine | Grille horaire 00h–24h, événements positionnés à l'heure |
| 📅 Vue Mois | Grille mensuelle avec prévisualisation événements |
| 📆 Vue Année | Aperçu 12 mois avec indicateurs visuels |
| ➕ Création | Modal complet : titre, dates, heures, lieu, description |
| 🔄 Récurrences | Quotidien, hebdo, mensuel, annuel avec date de fin |
| 🏷 Catégories | Couleurs personnalisables par catégorie |
| 🎨 Couleurs | Palette + sélecteur de couleur libre par événement |
| 🔐 Auth | Inscription + connexion sécurisée (bcrypt) |
| 📱 Responsive | Sidebar mobile avec menu hamburger |
| ⌨️ Raccourcis | `Ctrl+N` → nouveau, `Échap` → fermer |

---

## 🛠 API Endpoints

### Auth (`php/auth.php`) — POST
| Action | Description |
|---|---|
| `connexion` | Connexion utilisateur |
| `inscription` | Créer un compte |
| `verifier` | Vérifier la session |
| `deconnexion` | Déconnecter |

### Événements (`php/evenements.php`)
| Méthode | Description |
|---|---|
| `GET ?debut=YYYY-MM-DD&fin=YYYY-MM-DD` | Lister les événements |
| `POST` | Créer un événement |
| `PUT` | Modifier un événement |
| `DELETE` | Supprimer un événement |

### Catégories (`php/categories.php`)
| Méthode | Description |
|---|---|
| `GET` | Lister les catégories |
| `POST` | Créer une catégorie |
| `PUT` | Modifier une catégorie |
| `DELETE` | Supprimer une catégorie |

---

## 🐛 Dépannage

**Erreur "Connexion base de données impossible"**
→ Vérifier les identifiants dans `php/config.php`

**Page blanche**
→ Activer les erreurs PHP : `error_reporting(E_ALL); ini_set('display_errors', 1);`

**Les appels API échouent (404)**
→ Vérifier que PHP est activé et que les fichiers sont dans le bon répertoire

**Session expirée immédiatement**
→ Vérifier que `session.save_path` est accessible en écriture
"# planniPro" 

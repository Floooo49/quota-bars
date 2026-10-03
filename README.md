# Plugins Claude Code

Marketplace de plugins pour [Claude Code](https://claude.com/claude-code).

## Installation

Dans Claude Code :

```
/plugin marketplace add Floooo49/claude-plugins
/plugin install quota-bars@floooo49-plugins
```

Puis redemarrer Claude Code (ou l'app de bureau).

Mise a jour : `/plugin marketplace update floooo49-plugins`.

## Plugins

### quota-bars

Deux barres sous le prompt : quota de la session de 5 heures et quota de la semaine,
avec pourcentage et heure de remise a zero.

- Necessite un abonnement Claude (Pro ou Max) et une version recente de Claude Code
  (plugins de hooks en fonctions).
- Dans l'app de bureau, les quotas sont lus tout de suite ; dans le terminal, les barres
  apparaissent apres la premiere reponse.

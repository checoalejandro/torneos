# Dual-Meet Atlas Chapalita - Ávila Camacho

Starter funcional para Railway con:

- Node.js + Express
- EJS
- Socket.IO para tiempo real
- Persistencia en JSON local, sin base de datos
- Login por contraseña con sesión
- Cuadro, grupos, semifinales y final
- UI monocromática con fuente Saira

## Variables de entorno

- `ADMIN_PASSWORD` contraseña para desbloquear acciones administrativas
- `SESSION_SECRET` secreto de sesión
- `NODE_ENV=production` en Railway

## Arranque local

```bash
npm install
npm start
```

## Railway

- Build: `npm install`
- Start: `npm start`
- Root: este directorio

## Notas funcionales

- El registro de parejas se guarda en `data/state.json`
- Sin sesión: solo visualización
- Con sesión: registro, iniciar, reordenar, guardar resultados y reset
- El resultado de cada partido se captura con ganador y puntaje del perdedor

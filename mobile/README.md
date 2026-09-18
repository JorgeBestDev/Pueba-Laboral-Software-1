# Vokter Mobile

Aplicación para compradores construida con Expo y React Native. El panel de administración continúa exclusivamente en la web.

## Inicio

1. Copia `.env.example` como `.env` y asigna la URL alcanzable de la API. Para un teléfono físico, reemplaza `10.0.2.2` por la IP LAN del equipo que ejecuta Flask; `127.0.0.1` apunta al propio teléfono y no funcionará.
2. Instala dependencias con `npm install`.
3. Ejecuta `npm start` y abre la app con Expo Go o un emulador.

En un teléfono físico, `localhost` apunta al propio teléfono: usa la IP local del equipo que ejecuta Flask.

Las compilaciones EAS del perfil `preview` usan la API desplegada en
`https://vokter-api.onrender.com/api/v1`, por lo que el APK puede conectarse
desde BlueStacks o desde un dispositivo físico sin depender de `localhost`.

## APK Android

La aplicación móvil actualmente solo está disponible para Android. El APK
incluido para descarga desde la aplicación web está en:

```text
../frontend/public/downloads/vokter-mobile.apk
```

Para generar una nueva compilación con Expo Application Services:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

El perfil `preview` de `eas.json` genera un APK instalable. Después de que
EAS finalice la compilación, descarga el artefacto y reemplaza el archivo
existente en `frontend/public/downloads/`.

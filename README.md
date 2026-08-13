# Visor de Xat de WhatsApp

Aquesta és una aplicació web en JavaScript dissenyada per visualitzar i explorar còpies de seguretat de xats de WhatsApp en un format amigable, modern i totalment interactiu. L'aplicació compta amb un mode fosc premium, cercador de missatges amb ressaltat, filtres de contingut multimèdia i un complet tauler d'estadístiques i gràfics.

## Estructura del Projecte i Còpia de Seguretat

> [!IMPORTANT]
> **La còpia de seguretat del xat ha d'estar allotjada a la carpeta `db`**.
> Aquesta carpeta és imprescindible perquè l'aplicació funcioni correctament.

La teva carpeta del projecte ha de tenir la següent estructura:

```text
/
├── db/                       <-- Carpeta amb la còpia de seguretat de WhatsApp
├── parser.js                 <-- Processa el fitxer _chat.txt a JSON
├── server.js                 <-- Servidor de Node.js (API i fitxers)
├── index.html                <-- Estructura de la pàgina web (Interfície)
├── styles.css                <-- Disseny, colors (mode fosc/clar) i animacions
├── app.js                    <-- Lògica interactiva, reproductor de veu, cerques i gràfics
└── README.md                 <-- Aquesta guia d'instruccions
```

### El fitxer `_chat.txt`

Aquest fitxer és el fitxer de text de l'exportació de WhatsApp (generalment amb format de marques de temps `[DD/MM/YY HH:MM:SS]`) i conté referències a fitxers adjunts mitjançant el patró `<adjunt: nom_de_fitxer.extensió>`.

---

## Descripció dels Fitxers

* **`parser.js`**: Llegeix de forma síncrona el fitxer de text del xat, neteja marques especials invisibles de format, gestiona els salts de línia (missatges de diversos paràgrafs) i enllaça els continguts multimèdia a les bombolles de xat segons el seu tipus (imatges, vídeos, stickers, notes de veu, documents o contactes).
* **`server.js`**: Un servidor HTTP nadiu de Node.js sense dependències. Serveix els fitxers estàtics, exposa les dades analitzades mitjançant enllaços API (`/api/messages` i `/api/stats`) i serveix el contingut de la carpeta `db/` amb gestió de contingut parcial (`206 Partial Content`) perquè puguis avançar o retrocedir ràpidament pels vídeos i àudios.
* **`index.html`**: Presenta la interfície d'estil WhatsApp Web, que inclou pestanyes de filtres multimèdia, barra de cerca de missatges i els panells modals per a estadístiques i galeria multimèdia (Lightbox).
* **`styles.css`**: Configura els estils visuals de l'aplicació, animacions i la variable de canvi entre mode fosc (per defecte) i mode clar.
* **`app.js`**: Gestiona la part interactiva del navegador: enllaça els filtres de cerca, fa lliscar automàticament les cerques ressaltades, implementa controls per a la velocitat de les notes de veu (`1.0x`, `1.5x`, `2.0x`) i dibuixa gràfics vectorials (SVG) de l'activitat de la comunitat.

---

## Com executar el projecte

### Requisits previs

Necessites tenir instal·lat **[Node.js](https://nodejs.org/)** a la teva màquina. No cal instal·lar cap biblioteca o dependència externa (com Express), ja que l'aplicació fa ús exclusiu de mòduls nadius de Node.js per oferir una execució lleugera i instantània.

### Instruccions de posada en marxa

1. **Obre el terminal** o la línia de comandes.
2. Navega fins a la carpeta del projecte:

   ```bash
   cd /ruta/a/la/teva/carpeta/
   ```

3. **Executa el servidor** de Node.js:

   ```bash
   node server.js
   ```

4. Un cop s'iniciï el servidor, veuràs el següent missatge al terminal:

   ```text
   Parsing WhatsApp chat log...
   Successfully parsed 2807 messages.
   WhatsApp Chat Viewer server is online at: http://localhost:3000
   ```

5. **Obre el teu navegador** web preferit i visita l'adreça:
   **[http://localhost:3000](http://localhost:3000)**

Ja podràs navegar de forma còmoda i interactiva per tota la conversa de WhatsApp!

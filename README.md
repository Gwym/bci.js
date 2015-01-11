bci.js
======

Brain computer interface in Javascript

node.js Server
============

Usage :
------------
Download or fetch form github, install dependencies and launch server :
```
cd server
npm install
node server.js
```
or for the last line,
```
node --harmony server.js
```
if you plan to use the serial/board simulator.

The board and databases are managed from webapp :

webapp (requires a server to connect)
---------------------------------------------------------------

Usage :
------------
Open file webapp/index.html in your browser
or go to your server root address if you have set the server's options to serve static files (serve_webapp: true).


Chromeapp (Chrome only)
======================

Allows to get data form USB serial

Usage :
------------
Launch as chrome application

# Conversion App

Offline Capable Web App for use on holiday to perform currency conversion and track spending on lists.

Prototype running on heroku [here](http://mv-conversion.herokuapp.com/)


## Design Notes
- Vanilla Javascript
- Node build script (using babelify & browserify)
- Simple Express server HTML endpoint to retrieve currency data
- Service Worker
- IndexedDB (using promise based ibd npm module)


## Installation

### Dependancies
- [Node.js](https://nodejs.org/en/) 
- npm

### Running the app

- Clone the repository
- Navigate to the project directory in the command line
- Run `npm install`
- Run `npm run build` to build the required files to the 'public' directory
- Run `npm run start` to run the server from the transpiled files


The app is now running on [localhost:8080](http://localhost:8080)

## Implementation Notes

I have tried to maintain separation between display and data in the structure of the app.

The App consists of the following modules

- main.js // instanciates the other modules 
  - displayHelper  // collection of pure functions to generate HTML
  - listHelper // module to interact with IndexedDB data store and store/retrieve information
  - conversionHelper // module to perform conversions (storing rates/currency labels etc)
  - networkHelper // module to retrieve rates from the HTML endpoint
  - serviceWorkerHelper // module to set up offline functionality and notify user of updates



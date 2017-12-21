const Browserify = require('browserify')
const fs = require('fs')
const rimraf = require('rimraf')
const ncp = require('ncp')

const b = Browserify({standalone: 'something'})
const dir = './public';
let dirDeletePromise;

const promiseWrap = (data, failed)=>{    // return promise that resolves to the rates
    return new Promise((resolve, reject)=>{
        (!failed) ? resolve() : reject()
    })
}


// remove the directory if it already exists
new Promise((resolve,reject)=>{ rimraf(dir, resolve)
}).then(()=>{ // THEN make the new public directory
    return new Promise((resolve, reject)=>{ fs.mkdir(dir, resolve) })
}).then(()=>{ // THEN copy across the client files
    return new Promise((resolve, reject)=>{ ncp('./src/client', dir, resolve)})
}).then(()=>{ // THEN browserify the main file
    return new Promise((resolve, reject)=>{
        let fileWriteOperation = fs.createWriteStream(`${dir}/main_bundle.js`)
        fileWriteOperation.on('finish', resolve()) // carry on the promise when it finishes the file write

        b.add(`${dir}/main.js`);
        b.bundle().pipe(fileWriteOperation)
    })
}).then(()=>{
    console.log("Things are done")
})








// THEN parse the file through babel

// THEN write the file to disk

// THEN remove the modules directory

// THEN remove/rename the bundle
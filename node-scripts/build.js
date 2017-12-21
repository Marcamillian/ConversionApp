const Browserify = require('browserify')
const fs = require('fs')
const rimraf = require('rimraf')
const ncp = require('ncp')

const b = Browserify({standalone: 'something'})
const dir = './public';
let dirDeletePromise;

//fs.rename('./node-scripts/test.js', './node-scripts/testrename.js', (err)=>{console.log(`Rename file : ${err}`)})

// remove the directory if it already exists
new Promise((resolve,reject)=>{ rimraf(dir, resolve)
}).then(()=>{ // THEN make the new public directory
    return new Promise((resolve, reject)=>{ fs.mkdir(dir, resolve) })
}).then(()=>{ // THEN copy across the client files
    return new Promise((resolve, reject)=>{ ncp('./src/client', dir, resolve)})
}).then(()=>{ // THEN browserify the main file & write to disk
    return new Promise((resolve, reject)=>{
        let fileWriteOperation = fs.createWriteStream(`${dir}/main_bundle.js`)
        
        b.add(`${dir}/main.js`);
        b.bundle().pipe(fileWriteOperation)

        fileWriteOperation.on('finish', resolve()) // resolve the promise when it finishes the file write
    })
// THEN parse the file through babel
}).then(()=>{   // THEN remove the modules directory
    return new Promise((resolve, reject)=>{ rimraf(`${dir}/modules`, resolve)})
})/*.then(()=>{ // remove the un-transpiled file 
    return new Promise((resolve, reject)=>{
        fs.unlink(`${dir}/main.js`, resolve)
    })
})*/.then(()=>{ // rename the bundle
    return new Promise((resolve, reject)=>{ fs.rename(`${dir}/main_bundle.js`, `${dir}/main1.js`, resolve )})
}).then(
    ()=>{ console.log("Finished the build")},
    (err)=>{console.log(`Couldn't rename: ${err}`)}
)
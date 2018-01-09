const browserify = require('browserify')
const fs = require('fs')
const rimraf = require('rimraf')
const ncp = require('ncp')
const babelify = require('babelify')

const dest_dir = './public';
const source_dir = './src/client'
let dirDeletePromise;

// remove the directory if it already exists
new Promise((resolve,reject)=>{ rimraf(dest_dir, resolve)
}).then(()=>{ // THEN make the new public directory
    return new Promise((resolve, reject)=>{ fs.mkdir(dest_dir, resolve) })
}).then(()=>{ // THEN copy across the client files
    return new Promise((resolve, reject)=>{ ncp(source_dir, dest_dir, resolve)})
}).then(()=>{ // THEN transpile (babel/browserify) the main file & write to disk
    return new Promise((resolve, reject)=>{
        let fileWriteOperation = fs.createWriteStream(`${dest_dir}/main_bundle.js`)
        
        browserify({debug:true})
            .transform(babelify)
            .require(`${source_dir}/main.js`, {entry:true})
            .bundle()
            .on("error", function(err){console.log("Error: "+ err.message)})
            .pipe(fileWriteOperation)

        fileWriteOperation.on('finish', resolve()) // resolve the promise when it finishes the file write
    })
}).then((err, result)=>{ // THEN write the file to dist
    console.log(`babel parse: ${result}`)
    return new Promise((resolve, reject)=>{ resolve()})
}).then(()=>{   // THEN remove the modules directory
    return new Promise((resolve, reject)=>{ rimraf(`${dest_dir}/modules`, resolve)})
}).then(()=>{ // remove the un-transpiled file 
    return new Promise((resolve, reject)=>{
        fs.unlink(`${dest_dir}/main.js`, resolve)
    })
}).then(()=>{ // rename the bundle
    return new Promise((resolve, reject)=>{ fs.rename(`${dest_dir}/main_bundle.js`, `${dest_dir}/main.js`, resolve )})
}).then(
    ()=>{ console.log("Finished the build")},
    (err)=>{console.log(`Couldn't rename: ${err}`)}
)
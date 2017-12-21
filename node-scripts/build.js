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


// remove the old dist folder !! TODO: and its contents - // create the new dist folder & subfolders
rimraf(dir, ()=>{
    promiseWrap("deleted"
    ).then(    // make the new directory
        ()=>{   fs.mkdirSync(dir)
                return promiseWrap()},
        ()=>{throw new Error(`${dir} not created`)}
    ).then(     // copy the files from src to public folder
        ()=>{ return promiseWrap(ncp('./src/client', dir)) },
        ()=>{}
    ).then(     // browserify the main file
        ()=>{
            b.add(`${dir}/main.js`)
            b.bundle().pipe(fs.createWriteStream(`${dir}/main_bundle1.js`))
            return promiseWrap()
        },
        ()=>{}
    ).then(
        ()=>{ rimraf(`${dir}/modules`, ()=>{console.log("done")})}
    )
    .catch((err)=>{
        console.log(`Build abandoned ${err}`)
    })
})




// copy the required files


// browserify the module test file into a bundle
///const destinationFile = fs.createWriteStream('main_bundled.js')


///b.add('./node-scripts/test.js');
///b.bundle().pipe(destinationFile)

///destinationFile.on('finish', ()=>{console.log("browserify bundle completed")})

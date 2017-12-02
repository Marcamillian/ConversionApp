const fs = require('fs')
const dir = './dist';


// remove the directory
if(fs.existsSync(dir)) fs.rmdirSync(dir)

// make the new directory
fs.mkdirSync(dir)

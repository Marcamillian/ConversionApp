test = require('tape')
ConversionHelper = require('./../src/modules/ConversionHelper.js')
DisplayHelper = require('./../src/modules/DisplayHelper.js')
NetworkHelper = require('./../src/modules/NetworkHelper.js')

test("Testing the module loading", (t)=>{
    t.ok(ConversionHelper(), "Checking the module loaded")
    t.end()
})

test("Conversion Helper tests", (t)=>{
    const convHelper = ConversionHelper()

    t.equals(convHelper.convertValue({sourceValue: 100, sourceCurrency: 'USD', targetCurrency: 'GBP'}), 75.2245)

    t.ok(convHelper.updateConversions(100, 'USD'), {topValue: 100, bottomValue: 100})

    t.end()
})

// can't reference DOCUMENT to create elements
test.skip("Display Helper tests", (t)=>{
    const displayHelper = DisplayHelper();

    t.ok(displayHelper)

    t.end()
})

test("Network Helper Tests", (t)=>{
    const networkHelper = NetworkHelper()

    t.ok(networkHelper, "Network helper loading")

    t.end()
})
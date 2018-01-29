
const ConversionHelper = ()=>{
    
    let returnObject = {}
    let coreUSDValue = 0;
    let curr = ['USD', 'GBP']
    let rates = {
        USD: 1,
        GBP: 0.752245
    }

    const setRates = (newRates)=>{
        return rates = newRates
    }

    const convertValue= ({sourceValue=0, sourceCurrency='USD', targetCurrency='GBP'}={})=>{
        const USD = sourceValue / rates[sourceCurrency]   // convert to base currency (USD)
        return USD*rates[targetCurrency]   // return value 
    }

    // functions to update what currency is being used

    const getCurr = (currIndex)=>{
        return curr[currIndex-1]
    }

    const setCurr = (currIndex, newCurr)=>{
        curr[currIndex-1] = newCurr
    }

    const updateConversions = (convertValue=coreUSDValue, sourceCurrency='USD')=>{
        
        // normalise to USD
        const incomingUSDValue = returnObject.convertValue({
            sourceValue: convertValue,
            sourceCurrency: sourceCurrency,
            targetCurrency: 'USD'
        })

        coreUSDValue = incomingUSDValue; // store this value for the future

        // update the value in top box
        const conversion1 = returnObject.convertValue({
            sourceValue: incomingUSDValue,
            sourceCurrency:'USD',
            targetCurrency: curr[0]
        }).toFixed(2)

        // update value in bottom box
        const conversion2 = returnObject.convertValue({
            sourceValue: incomingUSDValue,
            sourceCurrency: 'USD',
            targetCurrency: curr[1]
        }).toFixed(2)
        return { topValue: conversion1, bottomValue: conversion2}
    }

    const getCurrLabels = ()=>{
        return Object.keys(rates)
    }

    const getCoreUSDValue = ()=>{
        return coreUSDValue
    }

    return Object.assign(returnObject,
        {
            setRates,
            convertValue,
            getCurr,
            setCurr,
            updateConversions,
            getCurrLabels,
            getCoreUSDValue
        }
    )
}


module.exports = ConversionHelper
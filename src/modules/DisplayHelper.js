const DisplayHelper = ()=>{
        
    if (!document) throw new Error("No document object to work with")   // check to see if there is a document object

    let returnObject = {}

    // add the events to the currencySelectButtons
    const showCurrSelect = (buttonClicked, currButtons)=>{
        // remove selected class from all buttons
        currButtons.forEach((button)=>{
            button.classList.remove('selected')
        })
        // set the currency to the same as the selected button
        
        // add the selected class to the selected button
        buttonClicked.classList.add('selected')
        
        return 
    }

    const revealPopup = (popupElement)=>{
        return popupElement.classList.add('active')
    }
    const hidePopup = (popupElement)=>{
        return popupElement.classList.remove('active')
    }

    const updateCurrencyLabel = (labelElement,currencyString)=>{
        labelElement.innerText = currencyString
    }

    const generateCurrSelectButton = (currLabel, selected)=>{
        const currButton = document.createElement('button');
        const checkElement = document.createElement('img');
        const labelName = document.createElement('p')

        
        
        labelName.innerText = currLabel // set the labelname

        checkElement.src = "assets/checkmark.svg";
        checkElement.classList.add("checkmark")

        if(selected) currButton.classList.add('selected')
        
        currButton.appendChild(checkElement)
        currButton.appendChild(labelName)

        return currButton
    }

    const emptyElement = (element)=>{
        while(element.children.length > 0){
            element.children[0].remove()
        }

        return element
    }

    return Object.assign(returnObject,
        {
            revealPopup,
            hidePopup,
            showCurrSelect,
            updateCurrencyLabel,
            generateCurrSelectButton,
            emptyElement
        }
    )
}

module.exports = DisplayHelper
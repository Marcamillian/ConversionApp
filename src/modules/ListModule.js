const idb = require('idb')

const ListModule = ()=>{
    const defaultListName = "Default List";
    let activeList = defaultListName;

    let dbPromise = idb.open('spend-lists',2, (upgradeDb)=>{
        switch(upgradeDb.oldVersion){
            case 0:
                var listStore = upgradeDb.createObjectStore('purchased-items', {autoIncrement: true});
                listStore.createIndex('by-list', "listName")
            case 1:
                var listNameStore = upgradeDb.createObjectStore('list-names');
                listNameStore.put(true,activeList)
        }
    })
    
    
    // IDB functions
    const addRecord = ({ listName=activeList , description="Something", cost=0 }= {})=>{
        return dbPromise.then((db)=>{
            var tx = db.transaction('purchased-items', 'readwrite')
            var listStore = tx.objectStore('purchased-items')
            listStore.put( {listName: listName, description: description, price: cost})
            return tx.complete;
        })
    }
    
    const createList = (listName)=>{
        return dbPromise.then((db)=>{
            var tx = db.transaction('list-names', 'readwrite')
            var listNameStore = tx.objectStore('list-names')
            listNameStore.put(true, listName)
            return tx.complete
        })
    }
    
    const changeList = (listName = defaultListName)=>{
        return getList(listName).then((listObject)=>{
            if(listObject != undefined){
                activeList = listName;
                return true
            }else{
                return false
            }
        })
    }
    
    const getList = (listName)=>{
        return dbPromise.then((db)=>{
            var tx = db.transaction('list-names')
            var listNameStore = tx.objectStore('list-names')
            return listNameStore.get(listName)
        })
    }
    
    const getListNames =()=>{
        return dbPromise.then((db)=>{
            var tx = db.transaction('list-names')
            var listStore = tx.objectStore('list-names')
            return listStore.getAllKeys()
        })
    }
    
    const getListItems = (listName = defaultListName)=>{
        return dbPromise.then((db)=>{
            var tx = db.transaction('purchased-items')
            var purchasedItemStore = tx.objectStore('purchased-items')
            return Promise.all([
                purchasedItemStore.getAll(),
                purchasedItemStore.getAllKeys()
            ])
        }).then((purchasedItemDetails)=>{
            return purchasedItemDetails[0].map((itemValues, index)=>{
                itemValues.storeKey = purchasedItemDetails[1][index]
                return itemValues
            }).filter((itemDetails)=>{
                return itemDetails.listName == listName
            })
        })
    }
    
    const deletePurchasedItem = (tableKey)=>{
        return dbPromise.then((db)=>{
            let tx = db.transaction('purchased-items', 'readwrite')
            let purchasedItemStore = tx.objectStore('purchased-items')
            return purchasedItemStore.delete(tableKey)
        })
    }
    
    const deleteList = (listName)=>{
        return dbPromise.then((db)=>{
            let tx = db.transaction(['list-names','purchased-items'], 'readwrite')
            let listNameStore = tx.objectStore('list-names')
            let purchasedItemStore = tx.objectStore('purchased-items')
    
            let listNameDelete = listNameStore.delete(listName);
            let listItemsDelete = purchasedItemStore.openCursor(null, "next").then(function removeItemByList(cursor){
                if(!cursor) return // recursive exit condition
                if(cursor.value.listName == listName) cursor.delete()    // if list is right - delete item
                return cursor.continue().then(removeItemByList) // move to the next item
            })
    
            return Promise.all([listNameDelete, listItemsDelete])
        })
    }

    const getActiveList = ()=>{
        return activeList.slice(0)
    }
    
    return {
        addRecord,
        createList,
        changeList,
        getList,
        getListNames,
        getListItems,
        deletePurchasedItem,
        deleteList,
        getActiveList
    }
}

module.exports = ListModule
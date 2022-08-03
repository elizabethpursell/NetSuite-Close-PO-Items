define(['N/search', 'N/record', 'N/email'], function(search, record, email){
    /**
      * @NApiVersion 2.x
      * @NScriptType ScheduledScript
      */
    function execute(scriptContext) {
        var poSearch = search.load({               //searches for POs that are not closed
            id: 'customsearchclose_po'
        });
        const closePO = [];
        poSearch.run().each(function(result){
            if(result != null && result != ''){
                var quantityBilled = result.getValue({          //gets quantities to check if it should be closed
                    name: "quantitybilled"
                });
                var quantityRec = result.getValue({
                    name: "quantityshiprecv"
                });
                var quantity = result.getValue({
                    name: "quantity"
                });
                var isClosed = result.getValue({
                    name: "closed"
                });
                if(quantityBilled >= quantity && quantityRec >= quantity && isClosed == false && (quantity != "" || quantity != null) && (quantityBilled != "" || quantityBilled != null) && (quantityRec != "" || quantityRec != null)){     //if they should be closed, add them to the array
                    var internalid = result.getValue({
                        name: "internalid"
                    });
                    if(internalid != closePO[(closePO.length - 1)]){        //add PO internal ID to array, no repeats
                        closePO.push(internalid);
                    }
                }
            }
            return true;
        });
        const PONames = [];
        const allLines = new Array(closePO.length);
        const fullClosed = [];
        for (var index = 0; index < closePO.length; index++){       //execute for every PO to be closed; load current PO, create array for its closeable items
            allLines[index] = new Array();
            var poRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: parseInt(closePO[index])
            });
            var allClosed = true;                                           //boolean to track full PO closure
            for (var i = 0; i < poRecord.getLineCount('item'); i++){        //execute for every item line in the PO
                var quantityBilled = poRecord.getSublistValue({             //get PO item's quantities
                    sublistId: 'item',
                    fieldId: 'quantitybilled',
                    line: i
                });
                var quantityRec = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantityreceived',
                    line: i
                });
                var quantity = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                });
              	var isClosed = poRecord.getSublistValue({
                	sublistId: "item",
                	fieldId: "isclosed",
                	line: i
                });
                if(quantityBilled >= quantity && quantityRec >= quantity && isClosed == false && (quantity != "" || quantity != null) && (quantityBilled != "" || quantityBilled != null) && (quantityRec != "" || quantityRec != null)){     //execute if the item should be closed
                    poRecord.setSublistValue({              //set item to closed
                        sublistId: 'item',
                        fieldId: 'isclosed',
                        line: i,
                        value: true
                    });
                    poRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'isopen',
                        line: i,
                        value: false
                    });
                  	var POName = poRecord.getValue({
                		fieldId: "tranid",
            		});
            		if(POName != PONames[(PONames.length - 1)]){        //add PO name to array, no repeats
                 		PONames.push(POName);
            		}
                  	var lineItem = poRecord.getSublistValue({       //add item name to array
                      sublistId: "item",
                      fieldId: "item_display",
                      line: i
                    });
                  	allLines[index].push(lineItem);
                }
                var isClosed = poRecord.getSublistValue({
                	sublistId: "item",
                	fieldId: "isclosed",
                	line: i
                });
                if(isClosed == false){          //set boolean to false if not all items are closed
                    allClosed = false;
                }
            }
            if(allClosed == true && POName != fullClosed[(fullClosed.length - 1)]){     //add PO name to array if all items are closed, no repeats
                fullClosed.push(POName);
            }
          	poRecord.save(false, false);        //save changes to PO record
        }
      	var items = allLines.filter(function(obj){		//clean data; remove blank item arrays
          	return obj[0] !== undefined;
        });
      	log.error("Items", items);
      	log.error("Internal IDs", closePO);
        log.error("Changed POs", PONames);
        log.error("Fully Closed POs", fullClosed);
      	var emailBody = "";
        if(closePO.length <= 0){            //execute if no POs were changed
            emailBody = "There have been no purchase order items closed today.";
        }
        else{               //execute if POs were changed
          	emailBody = "<b>The Following Purchase Order Items Have Been Closed:</b><br><br>";      //create html string of all the POs and items that were changed
      	    for(var j = 0; j < items.length; j++){
                var currentPO = PONames[j].toString();
                emailBody = emailBody + "- " + "<b>" + currentPO + "</b>" + ": ";
                for(var k = 0; k < items[j].length; k++){
                  	var currentItem = items[j][k].toString();
                    if(k == (items[j].length - 1)){
                        emailBody = emailBody + currentItem + "<br>";
                    }
                    else{
                        emailBody = emailBody + currentItem + ", ";
                    }
                }
            }
            if(fullClosed.length > 0){          //execute if POs were fully closed/billed
                emailBody = emailBody + "<br><b>The Following Purchase Orders Have Been Fully Closed/Billed:</b><br>";      //create html string of all the POs and items that were fully billed/closed
                for(var m = 0; m < fullClosed.length; m++){
                    var fullClosedPO = fullClosed[m].toString();
                    emailBody = emailBody + "- " + fullClosedPO + "<br>";
                }
            }
        }
      	email.send({                    //send the email
            author: 2655,		        //internal ID of user
            recipients: "fakeemail.com",
            subject: "Daily PO Close Update",
            body: emailBody
        });
      	log.error("Number of POs Changed", PONames.length);      //log the number of POs changed
    }
    return {
        execute: execute
    }
});

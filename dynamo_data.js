var AWS = require('aws-sdk');

// Create DynamoDB service object
var ddb = new AWS.DynamoDB({ region: 'eu-west-1', apiVersion: '2012-08-10' });

var myTable = 'SlotPositionTable';

var data = [
    { 'slotPosition': { 'N': '0' }, 'imageFile': { 'S': 'spad_a.png' } },
    { 'slotPosition': { 'N': '1' }, 'imageFile': { 'S': 'spad_k.png' } },
    { 'slotPosition': { 'N': '2' }, 'imageFile': { 'S': 'spad_q.png' } },
    { 'slotPosition': { 'N': '3' }, 'imageFile': { 'S': 'spad_j.png' } },
    { 'slotPosition': { 'N': '4' }, 'imageFile': { 'S': 'hart_a.png' } },
    { 'slotPosition': { 'N': '5' }, 'imageFile': { 'S': 'hart_k.png' } },
    { 'slotPosition': { 'N': '6' }, 'imageFile': { 'S': 'hart_q.png' } },
    { 'slotPosition': { 'N': '7' }, 'imageFile': { 'S': 'hart_j.png' } },
    { 'slotPosition': { 'N': '8' }, 'imageFile': { 'S': 'diam_a.png' } },
    { 'slotPosition': { 'N': '9' }, 'imageFile': { 'S': 'diam_k.png' } },
    { 'slotPosition': { 'N': '10' }, 'imageFile': { 'S': 'diam_q.png' } }
]

function putItem(element) {

    var params = {
        TableName: myTable,
        Item: element
    };

    ddb.putItem(params, function(err, data) {
        if (err) {
            console.log("Error", err);
        }
        else {
            console.log("Success", data);
        }
    });
}

data.forEach(putItem)

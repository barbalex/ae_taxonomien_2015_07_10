/*
 * Objekt neu aufbauen
 * damit die Reihenfolge passt und die Taxonomie die Gruppe enthält
 * Reihenfolge:
 * 1. Taxonomie
 * 2. Taxonomien
 * 3. Eigenschaftensammlungen
 * 4. Beziehungssammlungen
 */

'use strict'

var couchPass = require('./couchPass.json')
var url = 'http://' + couchPass.user + ':' + couchPass.pass + '@127.0.0.1:5984'
var nano = require('nano')(url)
var adb = nano.db.use('artendb')
var _ = require('lodash')

var docsWritten = 0

function bulkSave (docs) {
  var bulk = {}
  bulk.docs = docs
  adb.bulk(bulk, function (error, result) {
    if (error) {
      console.log('error after bulk:', error)
    } else {
      docsWritten = docsWritten + 100
      console.log('docsWritten', docsWritten)
      console.log('result[0]:', result[0])
    }
  })
}

adb.view('artendb', 'prov_tax_ohne_gruppe', {
  'include_docs': true
}, function (err, body) {
  if (!err) {
    // extract object docs from result
    var docsArray = body.rows.map(function (row) {
      return row.doc
    })

    var docs = []
    var docsPrepared = 0

    _.forEach(docsArray, function (doc) {
      if (doc.Gruppe && doc.Taxonomie && doc.Taxonomien) {
        if (doc.Taxonomien) {
          if (doc.Taxonomien[0]) {
            if (!doc.Taxonomien[0].Gruppe) {
              // dont do docs already done
              // es, bs und tax kopieren
              var neueEs = {}
              var neueBS = {}
              var neueTaxonomien = _.cloneDeep(doc.Taxonomien)
              if (doc.Eigenschaftensammlungen) neueEs = _.cloneDeep(doc.Eigenschaftensammlungen)
              if (doc.Beziehungssammlungen) neueBS = _.cloneDeep(doc.Beziehungssammlungen)

              // Taxonomie in Taxonomien erhält die Gruppe, vor Eigenschaften
              var tax = neueTaxonomien[0]
              var eig = {}
              if (tax.Eigenschaften) {
                eig = _.cloneDeep(tax.Eigenschaften)
                delete tax.Eigenschaften
              }
              tax.Gruppe = doc.Gruppe
              tax.Eigenschaften = eig

              // es, bs und tax löschen
              if (doc.Eigenschaftensammlungen) delete doc.Eigenschaftensammlungen
              if (doc.Beziehungssammlungen) delete doc.Beziehungssammlungen
              if (doc.Taxonomien) delete doc.Taxonomien

              // in der richtigen Reihenfolge neu einsetzen
              doc.Taxonomien = neueTaxonomien
              doc.Eigenschaftensammlungen = neueEs
              doc.Beziehungssammlungen = neueBS

              docs.push(doc)
              if (docs.length > 100) {
                bulkSave(docs.splice(0, 100))
                docsPrepared = docsPrepared + 100
                console.log('docsPrepared', docsPrepared)
              }
            }
          } else {
            console.log('doc ' + doc._id + ' has no Taxonomien[0]')
          }
        } else {
          console.log('doc ' + doc._id + ' has no Taxonomien')
        }
      } else {
        console.log('doc ' + doc._id + ' has no Gruppe or no Taxonomie')
      }
    })
  } else {
    console.log('err: ', err)
  }
})

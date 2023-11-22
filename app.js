const express = require('express')
const shadowsObj = require('./utilsShadows.js')
const webSockets = require('./utilsWebSockets.js')

/*
    WebSockets server, example of messages:

    From client to server:
        - Mouse over cell       { "type": "cellOver", "value", 0 }
        - Choosen cell          { "type": "cellChoice", "value", 0 }

    From server to client:
        - socketId              { "type": "socketId", "value": "001" }
        - initMatch             { "type": "initMatch", "value": match }
        - gameRound             { "type": "gameRound", "value": match }
        - opponentOver          { "type": "opponentOver", value: 0 }
        - gameOver              { "type": "gameOver", "winner": "X", "value": match }

    match objects are like: 
        { 
            playerX: "001", 
            playerO: "002", 
            board: ["X", "", "", "", "", "", "", "", ""],
            nextTurn: "O"
        }
    cell values are like:
        0 1 2
        3 4 5
        6 7 8
    winner values are like:
        "X" or "O" or "" (in case of tie)
 */

var ws = new webSockets()
let shadows = new shadowsObj()

// Jugadors i partides
let matches = []

// Start HTTP server
const app = express()
const port = process.env.PORT || 8888

// Publish static files from 'public' folder
app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, appListen)
async function appListen () {
  await shadows.init('./public/index.html', './public/shadows')
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
  console.log(`Development queries on: http://localhost:${port}/index-dev.html`)
}

// Close connections when process is killed
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  httpServer.close()
  ws.end()
  process.exit(0);
}

// WebSockets
ws.init(httpServer, port)

ws.onConnection = (socket, id) => {

  console.log("WebSocket client connected: " + id)
  idMatch = -1
  playersReady = false

  if (matches.length == 0) {
    // Si no hi ha partides, en creem una de nova
    idMatch = 0
    matches.push({
      playerX: id, 
      playerO: "", 
      board: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      nextTurn: "X",
      cell1: -11,
      cell2: -11,
      cellsToDraw: [],
      showIncorrect: false,
      playerXPoints: 0,
      playerOPoints: 0
    })
  } else {
    // Si hi ha partides, mirem si n'hi ha alguna en espera de jugador
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].playerX == "") {
        idMatch = i
        matches[i].playerX = id
        playersReady = true
        break
      } else if (matches[i].playerO == "") {
        idMatch = i
        matches[i].playerO = id
        playersReady = true
        break
      }
    }
    // Si hi ha partides, però totes ocupades creem una de nova
    if (idMatch == -1) {
      idMatch = matches.length
      matches.push({ 
        playerX: id, 
        playerO: "", 
        board: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        nextTurn: "X",
        cell1: -11,
        cell2: -11,
        cellsToDraw: [],
        showIncorrect: false,
        playerXPoints: 0,
        playerOPoints: 0
      })
    }
  }

  // Enviem l'identificador de client socket
  socket.send(JSON.stringify({
    type: "socketId",
    value: id
  }))

  // Enviem l'estat inicial de la partida
  socket.send(JSON.stringify({
    type: "initMatch",
    value: matches[idMatch]
  }))

  // Si ja hi ha dos jugadors
  if (playersReady) {
    let idOpponent = ""
    if (matches[idMatch].playerX == id) {
      idOpponent = matches[idMatch].playerO
    } else {
      idOpponent = matches[idMatch].playerX
    }

    let wsOpponent = ws.getClientById(idOpponent)
    if (wsOpponent != null) {
      // Informem al oponent que ja té rival
      wsOpponent.send(JSON.stringify({
        type: "initMatch",
        value: matches[idMatch]
      }))

      // Informem al oponent que toca jugar
      wsOpponent.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))

      // Informem al player que toca jugar
      socket.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))
    }
  }
}

ws.onMessage = (socket, id, msg) => {
  let obj = JSON.parse(msg)
  let idMatch = -1
  let playerTurn = ""
  let idSend = ""
  let wsSend = null

  // Busquem la partida a la que pertany el client
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      break
    }
  }

  // Processar el missatge rebut
  if (idMatch != -1) {
    let idOpponent = ""
        if (matches[idMatch].playerX == id) {
          idOpponent = matches[idMatch].playerO
        } else {
          idOpponent = matches[idMatch].playerX
        }
    let wsOpponent = ws.getClientById(idOpponent)
    switch (obj.type) {
    case "setPlayerName":
      if (matches[idMatch].opponentName != null) {
        matches[idMatch].opponentName2 = obj.value
      } else {
        matches[idMatch].opponentName = obj.value
      }
        // Recargamos la match para que aparezca el nombre del rival en el caso de que te hayas conectado primero
        if (wsOpponent != null) {
          wsOpponent.send(JSON.stringify({
            type: "initMatch",
            value: matches[idMatch]
          }))
          // Informem al oponent que toca jugar
          wsOpponent.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))

          // Informem al player que toca jugar
          socket.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))
        }
      break
    case "cellOver":
      // Si revem la posició del mouse de qui està jugant, l'enviem al rival
      playerTurn = matches[idMatch].nextTurn
      idSend = matches[idMatch].playerX
      if (playerTurn == "X") idSend = matches[idMatch].playerO

      wsSend = ws.getClientById(idSend)
      if (wsSend != null) {
        wsSend.send(JSON.stringify({
          type: "opponentOver",
          value: obj.value
        }))
      }
      break
    case "setBoard":
      if (matches[idMatch].board[0] == 0) {
        matches[idMatch].board = obj.value;
      }
      break
    case "cellClick":
      let isAllSet = false;
      if (matches[idMatch].cell1 == -11) {
        matches[idMatch].cell1 = obj.value
      }
      else if (matches[idMatch].cell2 == -11) {
        matches[idMatch].cell2 = obj.value
      }
      if (matches[idMatch].cell1 != -11 && matches[idMatch].cell2 != -11) {
        if (matches[idMatch].board[matches[idMatch].cell1] == matches[idMatch].board[matches[idMatch].cell2]) {
          matches[idMatch].cellsToDraw.push(matches[idMatch].board[matches[idMatch].cell1])
          // Sum the points to the current player
          if (matches[idMatch].playerX == id) {
            matches[idMatch].playerXPoints += 1
          } else {
            matches[idMatch].playerOPoints += 1
          }
          // Reset the recived cells
          matches[idMatch].cell1 = -11;
          matches[idMatch].cell2 = -11;
          // Check if all the images are already showed
          if (matches[idMatch].cellsToDraw.length == 8) {
            isAllSet = true
            for (let i = 1; i <= matches[idMatch].cellsToDraw.length; i++) {
              if (!(matches[idMatch].cellsToDraw.includes(i))) {
                isAllSet = false;
                break;
              }
            } 
          }
        } else {
          matches[idMatch].showIncorrect = true;
        }
      }
      if (isAllSet) { // Send gameOver. All the cells have been showed
        let playerXPoints = matches[idMatch].playerXPoints
        let playerOPoints = matches[idMatch].playerOPoints
        let winner = matches[idMatch].opponentName;
        if (playerOPoints > playerXPoints) {
          winner = matches[idMatch].opponentName2;
        }
        else if (playerXPoints == playerOPoints) {
          winner = "";
        }
        if (wsOpponent != null) {
          // Informem al oponent que toca jugar
          wsOpponent.send(JSON.stringify({
            type: "gameOver",
            value: matches[idMatch],
            winner: winner
          }))

          // Informem al player que toca jugar
          socket.send(JSON.stringify({
            type: "gameOver",
            value: matches[idMatch],
            winner: winner
          }))
        }
      } else {
        // Recargamos la match para que aparezca la nueva img
        if (wsOpponent != null) {
          // Informem al oponent que toca jugar
          wsOpponent.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))

          // Informem al player que toca jugar
          socket.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))
        }
      }
      console.log("hiciste click");
      break
    case "resetCells":
      if (matches[idMatch].cell1 != -11 && matches[idMatch].cell2 != -11) {
        matches[idMatch].cell1 = -11
        matches[idMatch].cell2 = -11
        matches[idMatch].showIncorrect = false

        if (matches[idMatch].nextTurn == "X") {
          matches[idMatch].nextTurn = "O"
        } else {
          matches[idMatch].nextTurn = "X"
        }

        // Informem al jugador de la partida
        socket.send(JSON.stringify({
          type: "gameRound",
          value: matches[idMatch]
        }))

        // Informem al rival de la partida
        wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
          }
      }
      break
    case "cellChoice":
      // Si rebem la posició de la cel·la triada, actualitzem la partida
      playerTurn = matches[idMatch].nextTurn
      matches[idMatch].board[obj.value] = playerTurn

      // Comprovem si hi ha guanyador
      let winner = ""
      let board = matches[idMatch].board

      // Verificar files
      if (board[0] == board[1] && board[0] == board[2]) winner = board[0]
      else if (board[3] == board[4] && board[3] == board[5]) winner = board[3]
      else if (board[6] == board[7] && board[6] == board[8]) winner = board[6]

      // Verificar columnes
      else if (board[0] == board[3] && board[0] == board[6]) winner = board[0]
      else if (board[1] == board[4] && board[1] == board[7]) winner = board[1]
      else if (board[2] == board[5] && board[2] == board[8]) winner = board[2]

      // Verificar diagonals
      else if (board[0] == board[4] && board[0] == board[8]) winner = board[0]
      else if (board[2] == board[4] && board[2] == board[6]) winner = board[2]

      // Comprovem si hi ha empat (ja no hi ha cap espai buit)
      let tie = true
      for (let i = 0; i < board.length; i++) {
        if (board[i] == "") {
          tie = false
          break
        }
      }

      if (winner == "" && !tie) {
        // Si no hi ha guanyador ni empat, canviem el torn
        if (matches[idMatch].nextTurn == "X") {
          matches[idMatch].nextTurn = "O"
        } else {
          matches[idMatch].nextTurn = "X"
        }

        // Informem al jugador de la partida
        socket.send(JSON.stringify({
          type: "gameRound",
          value: matches[idMatch]
        }))

        // Informem al rival de la partida
        idOpponent = ""
        if (matches[idMatch].playerX == id) {
          idOpponent = matches[idMatch].playerO
        } else {
          idOpponent = matches[idMatch].playerX
        }
        wsOpponent = ws.getClientById(idOpponent)
        if (wsOpponent != null) {
          wsOpponent.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))
        }
      } else {
        // Si hi ha guanyador o empat, acabem la partida

          // Informem al jugador de la partida
          socket.send(JSON.stringify({
            type: "gameOver",
            value: matches[idMatch],
            winner: winner
          }))

          // Informem al rival de la partida
          let idOpponent = ""
          if (matches[idMatch].playerX == id) {
            idOpponent = matches[idMatch].playerO
          } else {
            idOpponent = matches[idMatch].playerX
          }
          let wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameOver",
              value: matches[idMatch],
              winner: winner
            }))
          }
      }

      break
    }
  }
}

ws.onClose = (socket, id) => {
  console.log("WebSocket client disconnected: " + id)

  // Busquem la partida a la que pertany el client
  idMatch = -1
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      break
    }
  }
  // Informem al rival que s'ha desconnectat
  if (idMatch != -1) {

    if (matches[idMatch].playerX == "" && matches[idMatch].playerO == "") {
      // Esborrar la partida per falta de jugadors
      matches.splice(idMatch, 1)
    } else {
      
      // Reiniciem el taulell
      matches[idMatch].board = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      matches[idMatch].cellsToDraw = []
      matches[idMatch].cell1 = -11
      matches[idMatch].cell2 = -11
      matches[idMatch].showIncorrect = false
      matches[idMatch].playerXPoints = 0
      matches[idMatch].playerOPoints = 0
      
      // Esborrar el jugador de la partida
      let rival = ""
      if (matches[idMatch].playerX == id) {
        matches[idMatch].playerX = ""
        rival = matches[idMatch].playerO
        delete matches[idMatch].opponentName
      } else {
        matches[idMatch].playerO = ""
        rival = matches[idMatch].playerX
        delete matches[idMatch].opponentName2
      }

      // Informar al rival que s'ha desconnectat
      let rivalSocket = ws.getClientById(rival)
      if (rivalSocket != null) {
        rivalSocket.send(JSON.stringify({
          type: "opponentDisconnected"
        }))
        rivalSocket.send(JSON.stringify({
          type: "opponentDisconnected"
        }))
        socket.send(JSON.stringify({
          type: "initMatch",
          value: matches[idMatch]
        }))
      }
    }
  }
}

// Configurar la direcció '/index-dev.html' per retornar
// la pàgina que descarrega tots els shadows (desenvolupament)
app.get('/index-dev.html', getIndexDev)
async function getIndexDev (req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.send(shadows.getIndexDev())
}

// Configurar la direcció '/shadows.js' per retornar
// tot el codi de les shadows en un sol arxiu
app.get('/shadows.js', getShadows)
async function getShadows (req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(shadows.getShadows())
}
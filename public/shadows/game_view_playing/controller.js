class GameViewPlaying extends HTMLElement {
    constructor() {
        super()
        this.canvas = null
        this.ctx = null

        // Estat del joc i coordenades de dibuix
        this.cellOver = -1  // Conté l'índex de la casella sobre la que està el ratolí
        this.cellOpponentOver = -1 // Conté l'índex de la casella sobre la que està l'oponent
        this.coords = { }   // Conté les coordenades, mides del canvas
        this.socketId = -1  // Conté l'identificador del socket
        this.match = {      // Conté la informació de la partida
            idMatch: -1,
            playerX: "",
            playerO: "",
            board: [],
            nextTurn: "X",
            opponentName: "",
            opponentName2: "",
            cell1: -11,
            cell2: -11,
            cellsToDraw: [],
            showIncorrect: false,
            playerXPoints: 0,
            playerOPoints: 0
        }
        this.opponentId = ""  // Conté l'id de l'oponent
        this.gameStatus = "waitingOpponent" 
        this.player = "X"
        this.playerName = ""
        this.isMyTurn = false
        this.winner = ""

        // Imatges
        this.imgX = null
        this.imgXloaded = false
        this.imgO = null
        this.imgOloaded = false
        this.imgHoverCat = null
        this.imgHoverCatLoaded = false
        this.imgCat1 = null
        this.imgCat1Loaded = false
        this.imgCat2 = null
        this.imgCat2Loaded = false
        this.imgCat3 = null
        this.imgCat3Loaded = false
        this.imgCat4 = null
        this.imgCat4Loaded = false
        this.imgCat5 = null
        this.imgCat5Loaded = false
        this.imgCat6 = null
        this.imgCat6Loaded = false
        this.imgCat7 = null
        this.imgCat7Loaded = false
        this.imgCat8 = null
        this.imgCat8Loaded = false

        // Funcions per controlar el redibuix i els FPS
        this.reRunLastDrawTime = Date.now();  // Nova propietat per rastrejar l'últim temps de dibuix
        this.reRunRequestId = null;           // Identificador per a la cancel·lació de requestAnimationFrame
        this.reRunShouldStop = false;

        // Crea l'element shadow DOM
        this.shadow = this.attachShadow({ mode: 'open' })
    }

    async connectedCallback() {
        // Quan es crea l'element shadow DOM (no quan es connecta el socket)

        // Preload images
        this.imgX = new Image()
        this.imgX.src = '/images/imgX.png'
        this.imgX.onload = () => { this.imgXloaded = true }

        this.imgO = new Image()
        this.imgO.src = '/images/imgO.png'
        this.imgO.onload = () => { this.imgOloaded = true }

        this.imgHoverCat = new Image()
        this.imgHoverCat.src = '/images/catHover.svg'
        this.imgHoverCat.onload = () => { this.imgHoverCatLoaded = true }

        this.imgCat1 = new Image()
        this.imgCat1.src = '/images/cat1.png'
        this.imgCat1.onload = () => { this.imgCat1Loaded = true }

        this.imgCat2 = new Image()
        this.imgCat2.src = '/images/cat2.png'
        this.imgCat2.onload = () => { this.imgCat2Loaded = true }

        this.imgCat3 = new Image()
        this.imgCat3.src = '/images/cat3.png'
        this.imgCat3.onload = () => { this.imgCat3Loaded = true }

        this.imgCat4 = new Image()
        this.imgCat4.src = '/images/cat4.png'
        this.imgCat4.onload = () => { this.imgCat4Loaded = true }

        this.imgCat5 = new Image()
        this.imgCat5.src = '/images/cat5.png'
        this.imgCat5.onload = () => { this.imgCat5Loaded = true }

        this.imgCat6 = new Image()
        this.imgCat6.src = '/images/cat6.png'
        this.imgCat6.onload = () => { this.imgCat6Loaded = true }

        this.imgCat7 = new Image()
        this.imgCat7.src = '/images/cat7.png'
        this.imgCat7.onload = () => { this.imgCat7Loaded = true }

        this.imgCat8 = new Image()
        this.imgCat8.src = '/images/cat8.png'
        this.imgCat8.onload = () => { this.imgCat8Loaded = true }

        // Carrega els estils CSS
        const style = document.createElement('style')
        style.textContent = await fetch('/shadows/game_view_playing/style.css').then(r => r.text())
        this.shadow.appendChild(style)
    
        // Carrega els elements HTML
        const htmlContent = await fetch('/shadows/game_view_playing/view.html').then(r => r.text())

        // Converteix la cadena HTML en nodes utilitzant un DocumentFragment
        const template = document.createElement('template')
        template.innerHTML = htmlContent
        
        // Clona i afegeix el contingut del template al shadow
        this.shadow.appendChild(template.content.cloneNode(true))

        // Definir els 'eventListeners' dels objectes 
        this.shadow.querySelector('#buttonDisconnect').addEventListener('click', this.actionDisconnect.bind(this))

        // Inicial el canvas
        this.initCanvas()

        // Vincular l'event de canvi de mida de la finestra a la mida del canvas
        window.addEventListener('resize', this.onResizeCanvas.bind(this))
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
        this.canvas.addEventListener('click', this.onMouseClick.bind(this))
    } 

    async disconnectedCallback() {
        // Quan es treu el shadow DOM de la pàgina (no quan es desconnecta el socket)

        this.shouldStop = true;
        cancelAnimationFrame(this.requestId);
    }

    async actionDisconnect () {
        this.match.cellsToDraw = []
        disconnect()
    }

    async showDisconnecting () {
        document.querySelector('game-ws').showView('game-view-disconnecting')
        await new Promise(resolve => setTimeout(resolve, 1500))
        document.querySelector('game-ws').showView('game-view-disconnected')
    }

    showInfo () {
        if (this.gameStatus == "gameRound") {
            let txt;
            if (this.isMyTurn) {
                txt = `Turn for: "${this.playerName}"`;
                if (this.player == "X") {
                    txt += ` || Playing against: <b>${this.match.opponentName2}</b>`
                    txt += ` || On hold: "${this.match.opponentName2}"`;
                } else {
                    txt += ` || Playing against: <b>${this.match.opponentName}</b>`
                    txt += ` || On hold: "${this.match.opponentName}"`;
                }   
            } else {
                if (this.player == "X") {
                    txt = `Turn for: "${this.match.opponentName2}"`;
                    txt += ` || Playing against: <b>${this.match.opponentName2}</b>`
                } else {
                    txt = `Turn for: "${this.match.opponentName}"`;
                    txt += ` || Playing against: <b>${this.match.opponentName}</b>`
                }
                txt += ` || On hold: "${this.playerName}"`;     
            }
            
            // let txt = `Connected to <b>${socket.url}</b>, with ID <b>${this.socketId}</b>.`
            this.shadow.querySelector('#connectionInfo').innerHTML = txt + JSON.stringify(this.match.board) + JSON.stringify(this.match.cellsToDraw) + this.match.playerXPoints + this.match.playerOPoints
        } else {
            this.shadow.querySelector('#connectionInfo').innerHTML = ""
        }
    }

    initCanvas () {
        
        // Obtenir una referència al canvas i al context
        this.canvas = this.shadow.querySelector('canvas')
        this.ctx = this.canvas.getContext('2d')

        // Definir la mida del canvas segons la resolución del dispositiu (amb 100 de retard pel Safari)
        setTimeout(() => { this.onResizeCanvas() }, 100)
    }

    onResizeCanvas () {
        // Definir la resolució en píxels del canvas 
        // tenint en compte la densitat de píxels del dispositiu

        if (!this.canvas) return // Pot ser que es cridi 'resizeCanvas' abans de crear el canvas

        var dpr = window.devicePixelRatio || 1
        this.canvas.width = this.canvas.offsetWidth * dpr
        this.canvas.height = this.canvas.offsetHeight * dpr
        var height = this.canvas.height
        var width = this.canvas.width

        // Calculate useful coords and sizes
        var thirdHorizontal = width / 4
        var thirdVertical = height / 4
        var cellSize = Math.min(thirdHorizontal, thirdVertical) - 20
        var sixth = cellSize / 2
        var centerX = width / 2 - 100
        var centerY = height / 2 - 100

        // Set coords
        this.coords.cellSize = cellSize
        this.coords.centerX = centerX
        this.coords.centerY = centerY
        this.coords.height = height
        this.coords.width = width
        this.coords.x = centerX - sixth - cellSize
        this.coords.y = centerY - sixth - cellSize
        this.coords.cells = []

        for (var cnt = 0; cnt < 16; cnt++) {
            var cellRow = cnt % 4
            var cellCol = Math.floor(cnt / 4)
            var cellX = this.coords.x + (cellRow * cellSize)
            var cellY = this.coords.y + (cellCol * cellSize)

            this.coords.cells.push({ x: cellX, y: cellY })
        }

        // Redibuixar el canvas
        this.restartRun()
    }

    onMouseMove (event) {

        if (this.isMyTurn && this.gameStatus == "gameRound") {

            // Obtenir les coordenades del ratolí respecte al canvas
            var dpr = window.devicePixelRatio || 1
            var x = event.offsetX * dpr
            var y = event.offsetY * dpr
            var previousCellOver = this.cellOver

            // Utilitza la funció getCell per a obtenir l'índex de la casella
            this.cellOver = this.getCell(x, y)

            if (previousCellOver != this.cellOver) {

                if (!(this.match.cellsToDraw.includes(this.match.board[this.cellOver]))) {
                    // Si és una casella jugable, canvia el cursor del ratolí
                    this.canvas.style.cursor = 'pointer'
                } else {
                    // Si no és jugable, restaura el cellOver i el cursor
                    this.cellOver = -1
                    this.canvas.style.cursor = 'default'
                }    

                // Envia al rival la casella del ratolí
                sendServer({
                    type: "cellOver",
                    value: this.cellOver
                })
            }
        }

        this.restartRun()
    }

    onMouseClick (event) {

        if (this.isMyTurn && this.gameStatus == "gameRound") {

            // Obtenir les coordenades del ratolí respecte al canvas
            var dpr = window.devicePixelRatio || 1
            var x = event.offsetX * dpr
            var y = event.offsetY * dpr
            
            // Utilitza la funció getCell per a obtenir l'índex de la casella
            this.cellOver = this.getCell(x, y)
            // let isInCellsToDraw = this.match.cellsToDraw.includes(cell);
            if (this.match.cellsToDraw.includes(this.match.board[this.cellOver])) {
                this.cellOver = -1
            }    

            if (this.cellOver != -1) {
                // Envia la jugada
                sendServer({
                    type:"cellClick",
                    //type: "cellChoice",
                    value: this.cellOver
                })
            }
        }

        this.restartRun()
    }

    onServerMessage (obj) {

        this.isMyTurn = false
        this.opponentId = ""
        this.cellOpponentOver = -1
        this.winner = ""

        switch (obj.type) {
        case "socketId":
            this.socketId = obj.value
            this.createNewBoard();
            break
        case "initMatch":
            this.match = obj.value
            break
        case "opponentDisconnected":
            console.log("opponentDisconnected")
            this.gameStatus = "waitingOpponent"
            this.showInfo()
            break
        case "opponentOver":
            this.cellOpponentOver = obj.value
            break
        case "gameOver":
            this.gameStatus = "gameOver"
            this.match = obj.value
            this.winner = obj.winner
            break
        case "gameRound":
            this.gameStatus = "gameRound"
            this.match = obj.value

            if (this.match.showIncorrect) {
                this.match.showIncorrect = false;
                this.showIncorrect();
            }

            if (this.match.playerX == this.socketId) {
                this.player = "X"
                this.opponentId = this.match.playerO
                if (this.match.nextTurn == "X") {
                    this.isMyTurn = true
                }
            } else {
                this.player = "O"
                this.opponentId = this.match.playerX
                if (this.match.nextTurn == "O") {
                    this.isMyTurn = true
                }
            }
            this.showInfo()
            break
        }
        

        this.restartRun()
    }

    getCell(x, y) {
        var cells = this.coords.cells
        var cellSize = this.coords.cellSize
    
        for (var cnt = 0; cnt < cells.length; cnt++) {
            var cell = cells[cnt]
            
            // Calcula les coordenades mínimes i màximes del requadre de la casella
            var x0 = cell.x
            var y0 = cell.y
            var x1 = cell.x + cellSize
            var y1 = cell.y + cellSize
            
            // Comprova si (x, y) està dins del requadre de la casella
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
                return cnt
            }
        }
    
        return -1  // Retorna -1 si (x, y) no està dins de cap casella
    }

    restartRun () {
        this.reRunLastDrawTime = Date.now()

        if (this.reRunRequestId != null) cancelAnimationFrame(this.reRunRequestId)

        this.reRunShouldStop = false
        this.reRunRequestId = requestAnimationFrame(this.run.bind(this))
    }

    run (timestamp) {

        // Si no té sentit seguir dibuixant (perquè no hi ha canvis de fa estona)
        if (this.reRunShouldStop) return

        // Mirar quanta estona ha passat des de l'últim dibuix
        const now = Date.now()
        const elapsed = now - this.reRunLastDrawTime;
        if (elapsed > 1000) { // Comprova si han passat més de 2 segons
            this.reRunShouldStop = true
            cancelAnimationFrame(this.reRunRequestId)
            return
        }

        // Calcula els fps (opcional)
        const fps = 1000 / elapsed
        // console.log(`FPS: ${fps.toFixed(2)}, time: ${elapsed}, timeStamp: ${timestamp.toFixed(4)}`)

        // Dibuixar la partida
        this.draw()

        // Guardar el temps actual per a la següent iteració
        //this.reRunLastDrawTime = now;    

        // Programa el pròxim frame
        this.reRunRequestId = requestAnimationFrame(this.run.bind(this))
    }

    draw () {

        this.ctx.fillStyle = 'white'
        this.ctx.fillRect(0, 0, this.coords.width, this.coords.height)

        // "waitingOpponent", "waintingMove", "move", "gameOver" 
        switch (this.gameStatus) {
            case "waitingOpponent":
                this.drawWaitingOpponent(this.ctx)
                break
            case "gameRound":
                this.drawBoard(this.ctx)
                break
            case "gameOver":
                this.drawBoard(this.ctx)
                this.drawGameOver(this.ctx)
                break
        }
    }

    drawLine (ctx, lineWidth, color, x0, y0, x1, y1) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.restore()
    }

    drawCircle (ctx, lineWidth, color, x, y, radius) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.restore()
    }

    drawRect (ctx, lineWidth, color, x, y, width, height) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.rect(x, y, width, height)
        ctx.stroke()
        ctx.restore()
    }

    fillRect (ctx, lineWidth, color, x, y, width, height) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.fillStyle = color
        ctx.rect(x, y, width, height)
        ctx.fill()
        ctx.restore()
    }

    drawText(ctx, fontFace, fontSize, color, alignment, text, x, y) {
        var dpr = window.devicePixelRatio || 1
        var prpFont = fontSize * dpr

        ctx.save()
        ctx.font = prpFont + "px " + fontFace
        var metrics = ctx.measureText(text)
        var textWidth = metrics.width

        switch (alignment) {
            case 'center':
                x -= textWidth / 2
                break
            case 'right':
                x -= textWidth
                break
            case 'left':
            default:
                // No adjustment needed for left alignment
                break
        }

        ctx.fillStyle = color
        ctx.fillText(text, x, y)
        ctx.restore()
    }

    drawImage (ctx, image, cellCoords, cellSize) {

        var x0 = cellCoords.x
        var y0 = cellCoords.y
        var x1 = cellCoords.x + cellSize
        var y1 = cellCoords.y + cellSize

        let dstWidth = x1 - x0
        let dstHeight = y1 - y0
    
        let imageAspectRatio = image.width / image.height
        let dstAspectRatio = dstWidth / dstHeight
    
        let finalWidth;
        let finalHeight;
    
        if (imageAspectRatio > dstAspectRatio) {
            finalWidth = dstWidth
            finalHeight = dstWidth / imageAspectRatio
        } else {
            finalHeight = dstHeight
            finalWidth = dstHeight * imageAspectRatio
        }
    
        let offsetX = x0 + (dstWidth - finalWidth) / 2
        let offsetY = y0 + (dstHeight - finalHeight) / 2
    
        ctx.drawImage(image, offsetX, offsetY, finalWidth, finalHeight)
    }

    drawWaitingOpponent (ctx) {
        var text = 'Waiting for an opponent...'
        var x = this.coords.centerX + 100
        var y = this.coords.centerY
        this.drawText(ctx, "Arial", 24, "black", "center", text, x, y)
    }

    drawGameOver (ctx) {
        var text = 'Game Over'
        if (this.winner != "") {
            text = text + `, guanyador: ${this.winner}`
        } else {
            text = text + ', empat'
        }
        var x = this.coords.centerX
        var y = this.coords.centerY
        this.drawText(ctx, "Arial", 24, "black", "center", text, x, y)
    }

    drawBoard (ctx) {
        var cellSize = this.coords.cellSize
        var board = this.match.board
        var colorX = "red"
        var colorO = "green"
        var colorBoard = "black"
        var colorOver = "lightblue"

        if (!this.isMyTurn) {
            colorX = "#888"
            colorO = "#888"
            colorBoard = "#888"
            colorOver = "#ccc"
        }

        // Dibuixa el contingut de la casella individualment
        if (this.match.cell1 != -11) {
            let catValue1 = this.match.board[this.match.cell1]
            let catImgLoaded = 'imgCat' + catValue1 + 'Loaded';
            let catImg = 'imgCat' + catValue1;
            let cellCoords = this.coords.cells[this.match.cell1]
            if (this[catImgLoaded]) this.drawImage(ctx, this[catImg], cellCoords, cellSize)
            else this.drawX(ctx, colorX, cellCoords, cellSize)
        }
        if (this.match.cell2 != -11) {
            let catValue2 = this.match.board[this.match.cell2]
            let catImgLoaded = 'imgCat' + catValue2 + 'Loaded';
            let catImg = 'imgCat' + catValue2;
            let cellCoords = this.coords.cells[this.match.cell2]
            if (this[catImgLoaded]) this.drawImage(ctx, this[catImg], cellCoords, cellSize)
            else this.drawX(ctx, colorX, cellCoords, cellSize)
        }

        // Per totes les caselles del tauler
        for (var cnt = 0; cnt < board.length; cnt++) {
            var cell = board[cnt]
            var cellCoords = this.coords.cells[cnt]

            // Si toca jugar, i el ratolí està sobre la casella, dibuixa la simulació de partida
            if (this.isMyTurn && this.cellOver == cnt && board[cnt] != 0) {
                this.fillRect(ctx, 10, colorOver, cellCoords.x, cellCoords.y, cellSize, cellSize)
                if (this.imgHoverCatLoaded) this.drawImage(ctx, this.imgHoverCat, cellCoords, cellSize)
                else this.drawX(ctx, colorX, cellCoords, cellSize)
            }

            // Si no toca jugar i la casella coincideix amb la posició del ratolí de l'oponent, ho dibuixem
            if (!this.isMyTurn && this.cellOpponentOver == cnt) {
                this.fillRect(ctx, 10, colorOver, cellCoords.x, cellCoords.y, cellSize, cellSize)
                if (this.imgHoverCatLoaded) this.drawImage(ctx, this.imgHoverCat, cellCoords, cellSize)
                else this.drawX(ctx, colorX, cellCoords, cellSize)
            }

            // Dibuixa el requadre de la casella
            this.drawRect(ctx, 10, colorBoard, cellCoords.x, cellCoords.y, cellSize, cellSize)

            // Dibuixa el contingut de la casella
            let isInCellsToDraw = this.match.cellsToDraw.includes(cell);
            if (isInCellsToDraw) {
                let catImgLoaded = 'imgCat' + cell + 'Loaded';
                let catImg = 'imgCat' + cell;
                if (this[catImgLoaded]) this.drawImage(ctx, this[catImg], cellCoords, cellSize)
                else this.drawX(ctx, colorX, cellCoords, cellSize)
            }
        }
    }

    drawX (ctx, color, cellCoords, cellSize) {
        var padding = 20
        var x0 = cellCoords.x + padding
        var y0 = cellCoords.y + padding
        var x1 = cellCoords.x + cellSize - padding
        var y1 = cellCoords.y + cellSize - padding
        this.drawLine(ctx, 10, color, x0, y0, x1, y1)
        x0 = cellCoords.x + cellSize - padding
        x1 = cellCoords.x + padding
        this.drawLine(ctx, 10, color, x0, y0, x1, y1)
    }

    drawO (ctx, color, cellCoords, cellSize) {
        var padding = 20
        var x = cellCoords.x + (cellSize / 2)
        var y = cellCoords.y + (cellSize / 2)
        this.drawCircle(ctx, 10, color, x, y, (cellSize / 2) - padding)
    }

    createNewBoard() {
        let newBoard = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        let isSetPosition1 = false;
        let isSetPosition2 = false;
        for (let i = 1; i <= 8;) {
            let position1;
            let position2;
            if (!isSetPosition1) {
                var randomNumber = Math.random();
                randomNumber *= 16;
                position1 = Math.floor(randomNumber);
                if (newBoard[position1] == 0) {
                    newBoard[position1] = i;
                    isSetPosition1 = true;
                }
            }
            if (!isSetPosition2) {
                var randomNumber2 = Math.random();
                randomNumber2 *= 16;
                position2 = Math.floor(randomNumber2);
                if (newBoard[position2] == 0) {
                    newBoard[position2] = i;
                    isSetPosition2 = true;
                }
            }
            if (isSetPosition1 && isSetPosition2) {
                isSetPosition1 = false;
                isSetPosition2 = false;
                ++i;
            }
        }
        this.match.board = newBoard;
        sendServer({
            type: "setBoard",
            value: this.match.board
        })
    }

    showIncorrect() {
        setTimeout(() => {
            sendServer({
                type: "resetCells"
            })
          }, "3000");
    }
}

// Defineix l'element personalitzat
customElements.define('game-view-playing', GameViewPlaying)
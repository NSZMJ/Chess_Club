
let gameHasStarted = false;
var board = null
var game = new Chess()
var $status = $('#status')
var $pgn = $('#pgn')
let gameOver = false;

// Variables for tap-to-move functionality
let selectedSquare = null;
let selectedPiece = null;

function onDragStart (source, piece, position, orientation) {
    // do not pick up pieces if the game is over
    if (game.game_over()) return false
    if (!gameHasStarted) return false;
    if (gameOver) return false;

    if ((playerColor === 'black' && piece.search(/^w/) !== -1) || (playerColor === 'white' && piece.search(/^b/) !== -1)) {
        return false;
    }

    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) || (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false
    }
}

function onDrop (source, target) {
    let theMove = {
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for simplicity
    };
    // see if the move is legal
    var move = game.move(theMove);


    // illegal move
    if (move === null) return 'snapback'

    socket.emit('move', theMove);

    updateStatus()
}

// New function for tap-to-move functionality
function onSquareClick(square) {
    // Don't allow moves if game is over or hasn't started
    if (game.game_over() || !gameHasStarted || gameOver) {
        return;
    }

    const piece = game.get(square);
    
    // If no piece is selected yet
    if (selectedSquare === null) {
        // Check if the clicked square has a piece and it's the player's turn
        if (piece) {
            const isPlayerPiece = (playerColor === 'white' && piece.color === 'w') || 
                                 (playerColor === 'black' && piece.color === 'b');
            const isCorrectTurn = (game.turn() === 'w' && piece.color === 'w') || 
                                 (game.turn() === 'b' && piece.color === 'b');
            
            if (isPlayerPiece && isCorrectTurn) {
                selectedSquare = square;
                selectedPiece = piece;
                // Highlight the selected square
                board.addClass(square, 'highlight-square');
                return;
            }
        }
    } 
    // If a piece is already selected
    else {
        // If clicking on the same square, deselect it
        if (square === selectedSquare) {
            board.removeClass(selectedSquare, 'highlight-square');
            selectedSquare = null;
            selectedPiece = null;
            return;
        }
        
        // Try to make the move
        let theMove = {
            from: selectedSquare,
            to: square,
            promotion: 'q' // Always promote to queen for simplicity
        };
        
        // Check if the move is legal
        const move = game.move(theMove);
        
        if (move !== null) {
            // Legal move - send it to the server
            socket.emit('move', theMove);
            updateStatus();
        }
        
        // Clear selection regardless of whether move was legal
        board.removeClass(selectedSquare, 'highlight-square');
        selectedSquare = null;
        selectedPiece = null;
    }
}

socket.on('newMove', function(move) {
    game.move(move);
    board.position(game.fen());
    // Clear any selection when opponent moves
    if (selectedSquare) {
        board.removeClass(selectedSquare, 'highlight-square');
        selectedSquare = null;
        selectedPiece = null;
    }
    updateStatus();
});

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
    board.position(game.fen())
}

function updateStatus () {
    var status = ''

    var moveColor = 'White'
    if (game.turn() === 'b') {
        moveColor = 'Black'
    }

    // checkmate?
    if (game.in_checkmate()) {
        status = 'Game over, ' + moveColor + ' is in checkmate.'
    }

    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position'
    }

    else if (gameOver) {
        status = 'Opponent disconnected, you win!'
    }

    else if (!gameHasStarted) {
        status = 'Waiting for black to join'
    }

    // game still on
    else {
        status = moveColor + ' to move'

        // check?
        if (game.in_check()) {
            status += ', ' + moveColor + ' is in check'
        }
        
    }

    $status.html(status)
    $pgn.html(game.pgn())
}

var config = {
    draggable: true,
    position: 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
    onSquareClick: onSquareClick, // Add click handler for tap-to-move
    pieceTheme: '/public/img/chesspieces/wikipedia/{piece}.png'
}
board = Chessboard('myBoard', config)
if (playerColor == 'black') {
    board.flip();
}

updateStatus()

var urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('code')) {
    socket.emit('joinGame', {
        code: urlParams.get('code')
    });
}

socket.on('startGame', function() {
    gameHasStarted = true;
    updateStatus()
});

socket.on('gameOverDisconnect', function() {
    gameOver = true;
    updateStatus()
});

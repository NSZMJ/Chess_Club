
let gameHasStarted = false;
var board = null
var game = new Chess()
var $status = $('#status')
var $pgn = $('#pgn')
let gameOver = false;
let hasForfeited = false;

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
// Add promotion UI
function showPromotionDialog(callback) {
    $("#promotionDialog").remove();
    const dialog = $(`
        <div id="promotionDialog" class="modal-overlay">
            <div class="modal">
                <div class="modal-title">Choose promotion</div>
                <div class="modal-actions">
                    <button class="promo-btn" data-piece="q">Queen</button>
                    <button class="promo-btn" data-piece="r">Rook</button>
                    <button class="promo-btn" data-piece="b">Bishop</button>
                    <button class="promo-btn" data-piece="n">Knight</button>
                </div>
            </div>
        </div>
    `);
    $("body").append(dialog);
    $(".promo-btn").on("click", function() {
        const piece = $(this).data("piece");
        $("#promotionDialog").remove();
        callback(piece);
    });
}

function isPromotionMove(source, target, piece) {
    // Only pawns promote
    if (piece[1] !== 'P' && piece[1] !== 'p') return false;
    // White pawn to 8th rank
    if (piece[0] === 'w' && target[1] === '8') return true;
    // Black pawn to 1st rank
    if (piece[0] === 'b' && target[1] === '1') return true;
    return false;
}


function onDrop (source, target) {
    const piece = game.get(source);
    // Only prompt for promotion if it's the player's move and a pawn is promoting
    if (piece && isPromotionMove(source, target, (playerColor === 'white' ? 'w' : 'b') + piece.type.toUpperCase())) {
        showPromotionDialog(function(promotion) {
            let theMove = {
                from: source,
                to: target,
                promotion: promotion
            };
            var move = game.move(theMove);
            if (move === null) return 'snapback';
            socket.emit('move', theMove);
            updateStatus();
            board.position(game.fen());
        });
        return;
    }
    let theMove = {
        from: source,
        to: target,
        promotion: 'q' // fallback, only used if not a promotion
    };
    var move = game.move(theMove);
    if (move === null) return 'snapback';
    socket.emit('move', theMove);
    updateStatus();
    // Ensure special moves like castling immediately reflect on the board
    board.position(game.fen());
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
            // Immediately reflect special moves like castling locally
            board.position(game.fen());
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
        const winner = (moveColor === 'White') ? 'black' : 'white';
        const iWon = (playerColor === winner);
        setTimeout(function(){ window.location.replace('/result?outcome=' + (iWon ? 'win' : 'lose')); }, 800);
    }

    // draw?
    else if (game.in_draw()) {
        status = 'Game over, drawn position'
        setTimeout(function(){ window.location.replace('/result?outcome=stalemate'); }, 800);
    }

    else if (gameOver) {
        status = 'Opponent disconnected, you win!'
        $("#endControls").show();
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

// Forfeit flow
$(document).on('click', '#homeBtn', function() {
    window.location.replace('/');
});

$(document).on('click', '#forfeitBtn', function() {
    if (hasForfeited) return;
    hasForfeited = true;
    socket.emit('forfeit', { code: urlParams.get('code') });
    $("#status").html('You forfeited.');
    $("#endControls").show();
});

socket.on('opponentForfeit', function() {
    gameOver = true;
    $("#status").html('Opponent forfeited. You win!');
    $("#endControls").show();
});

module.exports = app => {

    app.get('/', (req, res) => {
        res.render('index');
    });

    app.get('/white', (req, res) => {
        res.render('game', {
            color: 'white'
        });
    });
    app.get('/black', (req, res) => {
        if (!games[req.query.code]) {
            return res.redirect('/?error=invalidCode');
        }

        res.render('game', {
            color: 'black'
        });
    });

    // Result page for end of game
    app.get('/result', (req, res) => {
        const outcome = (req.query.outcome || '').toLowerCase(); // 'win' | 'lose' | 'stalemate'
        let title = 'Game Over';
        let message = '';

        if (outcome === 'win') {
            title = 'You Win!';
            message = 'Great game. Well played!';
        } else if (outcome === 'lose') {
            title = 'You Lose';
            message = 'Good effort. Try again!';
        } else if (outcome === 'stalemate') {
            title = 'Stalemate';
            message = 'The game ended in a stalemate.';
        } else {
            return res.redirect('/');
        }

        res.render('result', { title, message, outcome });
    });
};

const jwt = require('jsonwebtoken');
const redis = require('redis');
const client = redis.createClient();

const checkSession = (req, res, next) => {
    const token = req.cookies.token;

    const path = req.path;
    // TODO clean up after testing
    if(path === '/test' || token === undefined && (path === '/login' || path === '/register' || path === '/loginauth')){
        next();
    }else if(token !== false && path === '/loginauth'){
        res.redirect('/');
    }else if(token === undefined && path !== '/login'){
        res.redirect('/login');
    }else{
        response = jwt.verify(token, process.env.node_sess_secret, (error, decoded) => {       
            if(error){
                switch(error['name']){
                    case 'TokenExpiredError':
                        switch(path){
                            case '/login':
                                res.clearCookie('token');
                                next();
                                break;
                            default:
                                res.redirect('/login');
                        }
                        break;
                    default:
                        // TODO error handling
                        console.log('error', error);
                }
            }else if(decoded){
                const redisKeySearch = 'jwtBL-' + deconded.exp;
                
                client.keys(redisKeySearch, (error, redisRes) => {
                    console.log(redisRes);
                });


                if(decoded.exp - (Date.now()/1000) <= 300){
                    const token = jwt.sign({username: decoded.username}, process.env.node_sess_secret, {algorithm: "HS256", expiresIn: process.env.node_sess_life });
                    res.cookie('token', token, {maxAge: process.env.node_sess_life,  httpOnly: true, secure: true});
	            
                }

                switch(path){
                    case '/login':
                        res.redirect('/test');    
                        break;
                    default:
                        next();
                }
            }
        });   
    }
}

module.exports.checkSession = checkSession;
const userModel = require('../models/users.js');
const {AuthTimeoutModel, knex} = require('../models/authentication_timeout.js');
const jwt = require('jsonwebtoken');
const client = require('../lib/redis.js');
const logger = require('../controller/winston.js');

const User = class User{
    constructor(username, ip){
        this.userName = username;
        this.ip = ip;
    }

    async getUser(){
             
        const userQuery = userModel.query().select().where('user_name', this.userName)
        
        return await userQuery
            .then(result => {
                const success = (result.length > 0 ? true : false);
                return {response: result[0], success: success, error: false};
            })
            .catch(error => {
                logger.crit({"message": error, "user": "system", "namespace": 'users.getuser.select.error'});
                return {success: false, error: true};
            });
    }

    async setSession(id, authGroup){
        return await new Promise((resolve, reject) =>{
            jwt.sign({user: id,group: authGroup}, process.env.node_sess_secret, {algorithm: "HS256", expiresIn: process.env.node_sess_life }, (error, token) =>{      
                if(error !== undefined){             
                    resolve(token);
                }else{
                    reject(error);          
                }
            });
        }).then(token =>{
            logger.info({"message": 'User has logged in', "user": `${this.userName}`, "namespace": 'users.setsession.jwt.sign'});
            return token;
        }).catch(error => {
            logger.crit({"message": {"code": escape(error)}, "user": "system", "namespace": 'users.setsession.jwt.sign'});
            return undefined;
        });
    }

    async createUser(pwHash){
        return await userModel.query().insert({user_name: this.userName, password: pwHash, active: 1})
                                .then(result => {
                                    return [{response: result, success: true}, {error: false}];
                                })
                                .catch(error => {
                                    const response = [];
                            
                                    const code = (error.nativeError === undefined ? error.code : error.nativeError.code);
                                  
                                    switch(code){
                                        case 'ER_DUP_ENTRY':
                                            response.push({response: 'Username already exists', success: false}, {error: false});
                                            break;
                                        default:
                                            logger.crit({"message": error, "user": "system", "namespace": 'users.createuser.insert.error'});
                                            response.push({response: 'An Unexpected error has occured, Admin have been notified', success: false}, {error: true});
                                    }

                                    return response;
                                });        
        
    }

    async invalidLogin(userResult){
        const userId = userResult.id;      
        //TODO universal date function
        const date = Math.round(Date.now() / 1000);

        return knex.raw('INSERT INTO `authentication_timeout` (`user_id`, `number_attempts`, `ip_address`,`last_attempt`, `created_on`) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE `number_attempts` = `number_attempts` + 1, `last_attempt` = ?', [userId, 1, this.ip,date,date,date])
        .then(() => {
            if(userResult.locked === 1){
                return {success: false}
            }
            return knex.raw('UPDATE users u INNER JOIN authentication_timeout at ON (at.user_id = u.id) SET u.locked=1, u.locked_on=? WHERE MOD(at.number_attempts,3) = 0 AND at.user_id=?',[date,userId])
            .then(updateResult => {
                let response = '';
                let success = false;
                if(updateResult[0].changedRows === 1){
                    response = 'Account has been locked, please wait 5 minutes';
                    logger.info({"message": response, "user": userId, "namespace": 'users.invalidlogin.login.locked'});
                    success = true;
                }else{
                    response = updateResult;
                    success = false;
                }

                return {response: response, success: success, error: false};

            }).catch(invalidUpdateError => logger.crit({"message": escape(invalidUpdateError), "user": "system", "namespace": 'users.invalidlogin.locked.update'}));
        }).then(userTimeoutResponse => {
            if(userTimeoutResponse.success === true){
                return userTimeoutResponse
            }else{
                const insertResponse = 'Invalid username or password';
                logger.info({"message": insertResponse, "user": userId, "namespace": 'users.invalidlogin.login.invalid'});
                return {response: 'Invalid username or password', success: true, error: false};
            }
        })
        .catch(insertUpdateError => logger.crit({"message": escape(insertUpdateError), "user": "system", "namespace": 'users.invalidlogin.insert.error'}));
    }

    processInactiveAccount(userDetails){
        const userId = userDetails.id;
        const coolDown = Math.round(Date.now() / 1000) - 300;
        let unlockStatus = false;

        if(userDetails.locked_on !== null && userDetails.locked_on <= coolDown){
            userModel.query().findById(userId).patch({locked: 0, locked_on: null})
                .then(()=> logger.info({"message": "Account has been unlocked due to cooldown", "user": userId, "namespace": 'users.processInactiveAccount.cooldown.unlock'}))
                .catch(coolDownError => logger.info({"message": coolDownError, "user": "system", "namespace": 'users.inactiveaccounts.select.error'}));
        
            unlockStatus = true;
        }

        return unlockStatus;
            
    }

    clearLoginAttempts(userId){
        AuthTimeoutModel.query().delete().where('user_id', '=', userId)
            .then(()=> logger.info({"message": "Account has been removed from timeout due to cooldown", "user": userId, "namespace": 'users.processInactiveAccount.cooldown.unlock'}))
            .catch(coolDownDeleteError => logger.info({"message": coolDownDeleteError, "user": "system", "namespace": 'users.clearloginattemps.delete.error'}));
    }

    logout(token){
        jwt.verify(token, process.env.node_sess_secret, (error, decoded) => {
            if(decoded === undefined){
                logger.crit({"message": {"code": error.message}, "user": "system", "namespace": 'users.logout.jwt.verify'});
            }else{
                client.LPUSH('jwtblacklist', decoded.exp);
                const jwtBlacklistKey = 'jwtbl-' + decoded.exp;
                client.LPUSH(jwtBlacklistKey, token);
            }
        });
    }
}

module.exports = User;
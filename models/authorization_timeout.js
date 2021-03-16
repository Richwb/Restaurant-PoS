const { Model } = require('objection');
const knex = require('./connection.js');

Model.knex(knex);

class AuthTimeout extends Model{
    static get tableName(){
        return 'authorization_timeout';
    }

    static get relationMappings() {
        const Users = require('./users.js');

        return {
            user: {
                relation: Model.BelongsToOneRelation,
                modelClass: Users,
                join: {
                    from: 'authorization_timeout.user_id',
                    to: 'users.id'
                }
            }
        }
    }

    async $beforeInsert() {
        console.log('insert');
        this.created_on = this.getDate();
    }

    async $beforeUpdate() {
        console.log('update');
        this.last_attempt = this.getDate(); 
    }

    getDate(){
        return new Date() / 1000;
    }

   
}

module.exports.AuthTimeoutModel = AuthTimeout;
module.exports.knex = knex;
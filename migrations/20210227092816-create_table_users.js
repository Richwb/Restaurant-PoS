'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.createTable(
      'users', 
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          allowNull: false,
          autoIncrement: true,
          unique: true
        },
        user_name: {
          type: Sequelize.STRING(12),
          allowNull: false,
          unique: true
        },
        password: {
          type: Sequelize.CHAR(60,true),
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(50),
          allowNull: true
         },
        last_login: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        created_on: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        updated_on: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        deactivated_on: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false
        }
      },
      {
        freezeTableName: true,
        timestamps: false
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.dropTable('users');
  }
};
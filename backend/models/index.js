const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ---------- Magasin (point de stockage) ----------
const Store = sequelize.define('Store', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    city: { type: DataTypes.STRING(100), allowNull: false }
}, { tableName: 'stores', timestamps: true });

// ---------- Utilisateur ----------
const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'manager'), allowNull: false, defaultValue: 'manager' },
    storeId: { type: DataTypes.UUID, allowNull: true } // null pour l'admin (accès à tous les magasins)
}, {
    tableName: 'users',
    timestamps: true,
    defaultScope: { attributes: { exclude: ['password'] } },
    scopes: { withPassword: { attributes: { include: ['password'] } } }
});

// ---------- Produit (catalogue commun) ----------
const Product = sequelize.define('Product', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    category: { type: DataTypes.STRING(60), allowNull: false },
    unit: { type: DataTypes.STRING(40), allowNull: false },
    minimumStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } },
    createdBy: { type: DataTypes.UUID, allowNull: false }
}, { tableName: 'products', timestamps: true });

// ---------- Stock courant (par produit ET par magasin) ----------
const CurrentStock = sequelize.define('CurrentStock', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    storeId: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0 } }
}, {
    tableName: 'current_stock',
    timestamps: true,
    indexes: [{ unique: true, fields: ['productId', 'storeId'] }]
});

// ---------- Mouvement de stock (journal immuable) ----------
const StockMovement = sequelize.define('StockMovement', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    productId: { type: DataTypes.UUID, allowNull: false },
    storeId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('entry', 'exit'), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    reason: { type: DataTypes.STRING(255), allowNull: true },
    userId: { type: DataTypes.UUID, allowNull: false }
}, {
    tableName: 'stock_movements',
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ['productId'] }, { fields: ['storeId'] }, { fields: ['createdAt'] }]
});

// ---------- Associations ----------
Store.hasMany(User, { foreignKey: 'storeId', as: 'users' });
User.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

User.hasMany(Product, { foreignKey: 'createdBy', as: 'createdProducts' });
Product.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Product.hasMany(CurrentStock, { foreignKey: 'productId', as: 'stocks', onDelete: 'RESTRICT' });
CurrentStock.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Store.hasMany(CurrentStock, { foreignKey: 'storeId', as: 'stocks', onDelete: 'RESTRICT' });
CurrentStock.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });

Product.hasMany(StockMovement, { foreignKey: 'productId', as: 'movements', onDelete: 'RESTRICT' });
StockMovement.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Store.hasMany(StockMovement, { foreignKey: 'storeId', as: 'movements', onDelete: 'RESTRICT' });
StockMovement.belongsTo(Store, { foreignKey: 'storeId', as: 'store' });
User.hasMany(StockMovement, { foreignKey: 'userId', as: 'movements', onDelete: 'RESTRICT' });
StockMovement.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { sequelize, Store, User, Product, CurrentStock, StockMovement };

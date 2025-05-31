// backend/src/controllers/adminController.js
const { User, Topic, ColumnMapping, UserTopicPermission, SystemLog, ImportLog, FailedImportRow, DeletionLog, sequelize } = require('../models'); // Added FailedImportRow
const logService = require('../services/logService');
const dbService = require('../services/dbService'); 
const bcrypt = require('bcryptjs');

// --- User Management ---

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, is_active, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const whereClause = {};
    if (role) whereClause.role = role;
    if (is_active !== undefined) whereClause.is_active = (is_active === 'true' || is_active === '1');
    if (search) {
        const { Op } = require('sequelize');
        whereClause[Op.or] = [
            { username: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } }
        ];
    }

    const { count, rows } = await User.findAndCountAll({
      attributes: { exclude: ['password'] }, 
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['created_at', 'DESC']]
    });

    await logService.logAction(req.user.id, 'ADMIN_GET_ALL_USERS', { query: req.query, count: rows.length }, req.ip);
    res.json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      users: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single user by ID (admin only)
 * @route   GET /api/admin/users/:userId
 * @access  Private/Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      await logService.logAction(req.user.id, 'ADMIN_GET_USER_FAILURE', { targetUserId: req.params.userId, reason: 'User not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'User not found' });
    }
    await logService.logAction(req.user.id, 'ADMIN_GET_USER_SUCCESS', { targetUserId: user.id, username: user.username }, req.ip);
    res.json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new user (admin only)
 * @route   POST /api/admin/users
 * @access  Private/Admin
 */
exports.createUser = async (req, res, next) => {
  const { username, email, password, role, is_active } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: 'Please provide username, email, password, and role.' });
  }
  try {
    const newUser = await User.create({ username, email, password, role, is_active });
    const userResponse = { ...newUser.toJSON() };
    delete userResponse.password; 

    await logService.logAction(req.user.id, 'ADMIN_CREATE_USER', { createdUserId: newUser.id, username: newUser.username, role: newUser.role }, req.ip);
    res.status(201).json({ success: true, message: 'User created successfully', user: userResponse });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        await logService.logAction(req.user.id, 'ADMIN_CREATE_USER_FAILURE', { username, email, reason: messages }, req.ip, 'FAILURE', messages);
        return res.status(400).json({ message: messages });
    }
    next(error);
  }
};

/**
 * @desc    Update a user (admin only)
 * @route   PUT /api/admin/users/:userId
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  const { userId } = req.params;
  const { username, email, role, is_active, password } = req.body; 

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      await logService.logAction(req.user.id, 'ADMIN_UPDATE_USER_FAILURE', { targetUserId: userId, reason: 'User not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.role = role || user.role;
    if (is_active !== undefined) {
      user.is_active = is_active;
    }
    if (password) { 
      user.password = password;
    }

    await user.save();
    const userResponse = { ...user.toJSON() };
    delete userResponse.password;

    await logService.logAction(req.user.id, 'ADMIN_UPDATE_USER', { targetUserId: user.id, updatedFields: Object.keys(req.body) }, req.ip);
    res.json({ success: true, message: 'User updated successfully', user: userResponse });
  } catch (error) {
     if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        await logService.logAction(req.user.id, 'ADMIN_UPDATE_USER_FAILURE', { targetUserId: userId, reason: messages }, req.ip, 'FAILURE', messages);
        return res.status(400).json({ message: messages });
    }
    next(error);
  }
};

/**
 * @desc    Delete a user (admin only)
 * @route   DELETE /api/admin/users/:userId
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      await logService.logAction(req.user.id, 'ADMIN_DELETE_USER_FAILURE', { targetUserId: userId, reason: 'User not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.id === req.user.id) {
      await logService.logAction(req.user.id, 'ADMIN_DELETE_USER_FAILURE', { targetUserId: userId, reason: 'Cannot delete self' }, req.ip, 'FAILURE');
      return res.status(403).json({ message: "You cannot delete your own account." });
    }

    await user.destroy();
    await logService.logAction(req.user.id, 'ADMIN_DELETE_USER', { deletedUserId: userId, username: user.username }, req.ip);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};


// --- Topic Management ---

/**
 * @desc    Create a new import topic
 * @route   POST /api/admin/topics
 * @access  Private/Admin
 */
exports.createTopic = async (req, res, next) => {
  const {
    name, target_db_host, target_db_port, target_db_name,
    target_table_name, target_db_user, target_db_password,
    column_mappings 
  } = req.body;

  if (!name || !target_db_host || !target_db_name || !target_table_name || !target_db_user || !target_db_password) {
    return res.status(400).json({ message: "Missing required fields for topic creation." });
  }
  if (column_mappings && !Array.isArray(column_mappings)) {
    return res.status(400).json({ message: "column_mappings must be an array."});
  }
  if (column_mappings) {
    for (const mapping of column_mappings) {
        if (!mapping.source_column_name || !mapping.target_column_name) {
            return res.status(400).json({ message: "Each column mapping must have source_column_name and target_column_name."});
        }
    }
  }


  const transaction = await sequelize.transaction();
  try {
    const newTopic = await Topic.create({
      name, target_db_host, target_db_port, target_db_name,
      target_table_name, target_db_user, 
      target_db_password, 
      created_by_id: req.user.id
    }, { transaction });

    let createdMappings = [];
    if (column_mappings && column_mappings.length > 0) {
      const mappingsToCreate = column_mappings.map(m => ({
        ...m,
        topic_id: newTopic.id
      }));
      createdMappings = await ColumnMapping.bulkCreate(mappingsToCreate, { transaction, validate: true });
    }

    if (createdMappings.length > 0) {
        try {
            await dbService.ensureTableExists(newTopic.toJSON(), createdMappings.map(cm => cm.toJSON()));
            await logService.logAction(req.user.id, 'ADMIN_TOPIC_TARGET_TABLE_ENSURED', { topicId: newTopic.id, tableName: newTopic.target_table_name }, req.ip, 'SUCCESS');
        } catch (dbEnsureError) {
            console.warn(`Failed to ensure target DB/Table for new topic ${newTopic.id}: ${dbEnsureError.message}`);
            await logService.logAction(req.user.id, 'ADMIN_TOPIC_TARGET_TABLE_ENSURE_WARN', { topicId: newTopic.id, error: dbEnsureError.message }, req.ip, 'FAILURE', dbEnsureError.message);
        }
    }


    await transaction.commit();
    await logService.logAction(req.user.id, 'ADMIN_CREATE_TOPIC', { topicId: newTopic.id, name: newTopic.name }, req.ip);
    res.status(201).json({ success: true, message: 'Topic created successfully', topic: newTopic, column_mappings: createdMappings });

  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        await logService.logAction(req.user.id, 'ADMIN_CREATE_TOPIC_FAILURE', { name, reason: messages }, req.ip, 'FAILURE', messages);
        return res.status(400).json({ message: messages });
    }
    next(error);
  }
};

/**
 * @desc    Get all topics
 * @route   GET /api/admin/topics
 * @access  Private/Admin
 */
exports.getAllTopics = async (req, res, next) => {
  try {
    const topics = await Topic.findAll({
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: ColumnMapping, as: 'columnMappings' } 
      ],
      order: [['name', 'ASC']]
    });
    await logService.logAction(req.user.id, 'ADMIN_GET_ALL_TOPICS', { count: topics.length }, req.ip);
    res.json({ success: true, topics });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single topic by ID
 * @route   GET /api/admin/topics/:topicId
 * @access  Private/Admin
 */
exports.getTopicById = async (req, res, next) => {
  try {
    const topic = await Topic.findByPk(req.params.topicId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username'] },
        { model: ColumnMapping, as: 'columnMappings' },
        { model: UserTopicPermission, as: 'userPermissions', include: [{model: User, attributes:['id', 'username']}]}
      ]
    });
    if (!topic) {
      await logService.logAction(req.user.id, 'ADMIN_GET_TOPIC_FAILURE', { topicId: req.params.topicId, reason: 'Topic not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'Topic not found' });
    }
    await logService.logAction(req.user.id, 'ADMIN_GET_TOPIC_SUCCESS', { topicId: topic.id, name: topic.name }, req.ip);
    res.json({ success: true, topic });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a topic and its column mappings
 * @route   PUT /api/admin/topics/:topicId
 * @access  Private/Admin
 */
exports.updateTopic = async (req, res, next) => {
  const { topicId } = req.params;
  const {
    name, target_db_host, target_db_port, target_db_name,
    target_table_name, target_db_user, target_db_password,
    column_mappings 
  } = req.body;

  const transaction = await sequelize.transaction();
  try {
    const topic = await Topic.findByPk(topicId, { transaction });
    if (!topic) {
      await transaction.rollback();
      await logService.logAction(req.user.id, 'ADMIN_UPDATE_TOPIC_FAILURE', { topicId, reason: 'Topic not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'Topic not found' });
    }

    topic.name = name || topic.name;
    topic.target_db_host = target_db_host || topic.target_db_host;
    topic.target_db_port = target_db_port || topic.target_db_port;
    topic.target_db_name = target_db_name || topic.target_db_name;
    topic.target_table_name = target_table_name || topic.target_table_name;
    topic.target_db_user = target_db_user || topic.target_db_user;
    if (target_db_password) { 
        topic.target_db_password = target_db_password; 
    }
    await topic.save({ transaction });

    let updatedMappings = [];
    if (column_mappings && Array.isArray(column_mappings)) {
        for (const mapping of column_mappings) {
            if (!mapping.source_column_name || !mapping.target_column_name) {
                await transaction.rollback();
                return res.status(400).json({ message: "Each column mapping must have source_column_name and target_column_name."});
            }
        }
        await ColumnMapping.destroy({ where: { topic_id: topicId }, transaction });
        if (column_mappings.length > 0) {
            const mappingsToCreate = column_mappings.map(m => ({
                ...m,
                id: undefined, 
                topic_id: topicId
            }));
            updatedMappings = await ColumnMapping.bulkCreate(mappingsToCreate, { transaction, validate: true });
        }
    } else {
        updatedMappings = await ColumnMapping.findAll({ where: { topic_id: topicId }, transaction });
    }
    
    if (column_mappings && updatedMappings.length > 0) { 
        try {
            await dbService.ensureTableExists(topic.toJSON(), updatedMappings.map(cm => cm.toJSON()));
             await logService.logAction(req.user.id, 'ADMIN_TOPIC_TARGET_TABLE_REVALIDATED', { topicId: topic.id, tableName: topic.target_table_name }, req.ip, 'SUCCESS');
        } catch (dbEnsureError) {
            console.warn(`Failed to re-validate target DB/Table for updated topic ${topic.id}: ${dbEnsureError.message}`);
            await logService.logAction(req.user.id, 'ADMIN_TOPIC_TARGET_TABLE_REVALIDATE_WARN', { topicId: topic.id, error: dbEnsureError.message }, req.ip, 'FAILURE', dbEnsureError.message);
        }
    }


    await transaction.commit();
    await logService.logAction(req.user.id, 'ADMIN_UPDATE_TOPIC', { topicId: topic.id, updatedFields: Object.keys(req.body) }, req.ip);
    
    const finalTopic = await Topic.findByPk(topicId, {
        include: [{ model: ColumnMapping, as: 'columnMappings' }]
    });
    res.json({ success: true, message: 'Topic updated successfully', topic: finalTopic });

  } catch (error) {
    await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeValidationError') {
        const messages = error.errors.map(e => e.message).join(', ');
        await logService.logAction(req.user.id, 'ADMIN_UPDATE_TOPIC_FAILURE', { topicId, reason: messages }, req.ip, 'FAILURE', messages);
        return res.status(400).json({ message: messages });
    }
    next(error);
  }
};

/**
 * @desc    Delete a topic
 * @route   DELETE /api/admin/topics/:topicId
 * @access  Private/Admin
 */
exports.deleteTopic = async (req, res, next) => {
  const { topicId } = req.params;
  const transaction = await sequelize.transaction();
  try {
    const topic = await Topic.findByPk(topicId, { transaction });
    if (!topic) {
      await transaction.rollback();
      await logService.logAction(req.user.id, 'ADMIN_DELETE_TOPIC_FAILURE', { topicId, reason: 'Topic not found' }, req.ip, 'FAILURE');
      return res.status(404).json({ message: 'Topic not found' });
    }

    await topic.destroy({ transaction });
    
    await transaction.commit();
    await logService.logAction(req.user.id, 'ADMIN_DELETE_TOPIC', { deletedTopicId: topicId, name: topic.name }, req.ip);
    res.json({ success: true, message: 'Topic and associated mappings/permissions deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};


// --- User Topic Permissions Management ---

/**
 * @desc    Assign/update permissions for a user on a topic
 * @route   POST /api/admin/permissions
 * @access  Private/Admin
 */
exports.manageUserTopicPermission = async (req, res, next) => {
  const { userId, topicId, can_import, can_view_data, can_delete_data } = req.body;

  if (userId === undefined || topicId === undefined) {
    return res.status(400).json({ message: 'userId and topicId are required.' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const topic = await Topic.findByPk(topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found.' });

    let permission = await UserTopicPermission.findOne({ where: { user_id: userId, topic_id: topicId } });

    const permissionDetails = {
        can_import: can_import !== undefined ? can_import : (permission ? permission.can_import : true),
        can_view_data: can_view_data !== undefined ? can_view_data : (permission ? permission.can_view_data : true),
        can_delete_data: can_delete_data !== undefined ? can_delete_data : (permission ? permission.can_delete_data : false),
    };


    if (permission) {
      permission.can_import = permissionDetails.can_import;
      permission.can_view_data = permissionDetails.can_view_data;
      permission.can_delete_data = permissionDetails.can_delete_data;
      await permission.save();
    } else {
      permission = await UserTopicPermission.create({
        user_id: userId,
        topic_id: topicId,
        ...permissionDetails
      });
    }
    await logService.logAction(req.user.id, 'ADMIN_MANAGE_PERMISSION', { targetUserId: userId, topicId, permissions: permissionDetails }, req.ip);
    res.json({ success: true, message: 'Permission updated successfully', permission });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove all permissions for a user on a topic
 * @route   DELETE /api/admin/permissions/:userId/:topicId
 * @access  Private/Admin
 */
exports.removeUserTopicPermission = async (req, res, next) => {
    const { userId, topicId } = req.params;
    try {
        const result = await UserTopicPermission.destroy({
            where: { user_id: userId, topic_id: topicId }
        });

        if (result === 0) {
            await logService.logAction(req.user.id, 'ADMIN_REMOVE_PERMISSION_FAILURE', { targetUserId: userId, topicId, reason: 'Permission not found' }, req.ip, 'FAILURE');
            return res.status(404).json({ message: 'Permission not found or already removed.' });
        }

        await logService.logAction(req.user.id, 'ADMIN_REMOVE_PERMISSION', { targetUserId: userId, topicId }, req.ip);
        res.json({ success: true, message: 'Permission removed successfully.' });
    } catch (error) {
        next(error);
    }
};


// --- Log Viewing ---

/**
 * @desc    Get system logs (admin only)
 * @route   GET /api/admin/logs/system
 * @access  Private/Admin
 */
exports.getSystemLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId, actionType, status, startDate, endDate, sortOrder = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    const whereClause = {};
    if (userId) whereClause.user_id = userId;
    if (actionType) whereClause.action_type = { [require('sequelize').Op.like]: `%${actionType}%` };
    if (status) whereClause.status = status;
    if (startDate && endDate) {
        whereClause.created_at = { [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)] };
    } else if (startDate) {
        whereClause.created_at = { [require('sequelize').Op.gte]: new Date(startDate) };
    } else if (endDate) {
        whereClause.created_at = { [require('sequelize').Op.lte]: new Date(endDate) };
    }

    const { count, rows } = await SystemLog.findAndCountAll({
      where: whereClause,
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
      order: [['created_at', sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit: parseInt(limit),
      offset: offset,
    });

    await logService.logAction(req.user.id, 'ADMIN_VIEW_SYSTEM_LOGS', { query: req.query, count: rows.length }, req.ip);
    res.json({
        success: true,
        count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        logs: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get import logs (admin only)
 * @route   GET /api/admin/logs/import
 * @access  Private/Admin
 */
exports.getImportLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, userId, topicId, status, startDate, endDate, sortOrder = 'DESC' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {};
    if (userId) whereClause.user_id = userId;
    if (topicId) whereClause.topic_id = topicId;
    if (status) whereClause.status = status;
     if (startDate && endDate) {
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);
        if (!isNaN(parsedStartDate.getTime()) && !isNaN(parsedEndDate.getTime())) {
            whereClause.created_at = { [require('sequelize').Op.between]: [parsedStartDate, parsedEndDate] };
        } else {
            console.warn("Invalid date format for import log filter:", {startDate, endDate});
        }
    } else if (startDate) {
        const parsedStartDate = new Date(startDate);
        if (!isNaN(parsedStartDate.getTime())) {
            whereClause.created_at = { [require('sequelize').Op.gte]: parsedStartDate };
        } else {
            console.warn("Invalid start date format for import log filter:", startDate);
        }
    } else if (endDate) {
        const parsedEndDate = new Date(endDate);
         if (!isNaN(parsedEndDate.getTime())) {
            whereClause.created_at = { [require('sequelize').Op.lte]: parsedEndDate };
        } else {
            console.warn("Invalid end date format for import log filter:", endDate);
        }
    }

    const { count, rows } = await ImportLog.findAndCountAll({
      where: whereClause,
      include: [
        { model: User, as: 'importer', attributes: ['id', 'username'] },
        { model: Topic, as: 'topic', attributes: ['id', 'name'] },
        { model: FailedImportRow, as: 'failedRows', attributes: ['id', 'row_number_in_file', 'error_message'] } 
      ],
      order: [['created_at', sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      limit: parseInt(limit),
      offset: offset,
    });
    await logService.logAction(req.user.id, 'ADMIN_VIEW_IMPORT_LOGS', { query: req.query, count: rows.length }, req.ip);
     res.json({
        success: true,
        count,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        logs: rows
    });
  } catch (error) {
    console.error("Error in getImportLogs (admin):", error); // Added console.error for backend debugging
    next(error);
  }
};

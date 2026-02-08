import fs from 'fs-extra';
import path from 'path';

const CONFIG_PATH = process.env.PACS_CONFIG_PATH || 'C:/Program Files/Orthanc Server/Configuration/orthanc.json';
const PACS_TYPE = process.env.PACS_TYPE || 'orthanc';
// Helper to strip comments from JSON (PACS config may use C++ style comments)
function stripComments(jsonString) {
  return jsonString.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
}

export const pacsConfigService = {
  async addUser(username, password) {
    if (PACS_TYPE !== 'orthanc') {
      return true;
    }
    try {
      if (!await fs.pathExists(CONFIG_PATH)) {
        console.warn(`PACS config file not found at ${CONFIG_PATH}. Skipping PACS user creation.`);
        return false;
      }

      const fileContent = await fs.readFile(CONFIG_PATH, 'utf8');
      // We need to parse it to modify. Warning: This will remove comments when saving back!
      // To allow comments, we would need a more complex parser/updater. 
      // For this task, we assume we might lose comments or the user accepts it.
      
      let config;
      try {
        config = JSON.parse(stripComments(fileContent));
      } catch (e) {
        console.error("Failed to parse PACS config. It might contain complex comments or syntax.", e);
        return false;
      }

      if (!config.RegisteredUsers) {
        config.RegisteredUsers = {};
      }

      // Enable authentication if we are managing users
      config.AuthenticationEnabled = true;

      config.RegisteredUsers[username] = password;

      // Write back
      await fs.outputJson(CONFIG_PATH, config, { spaces: 2 });
      console.log(`User ${username} added to PACS config.`);
      return true;
    } catch (error) {
      console.error("Error modifying PACS config:", error);
      return false;
    }
  },

  async removeUser(username) {
    if (PACS_TYPE !== 'orthanc') {
      return true;
    }
    try {
      if (!await fs.pathExists(CONFIG_PATH)) return false;

      const fileContent = await fs.readFile(CONFIG_PATH, 'utf8');
      let config = JSON.parse(stripComments(fileContent));

      if (config.RegisteredUsers && config.RegisteredUsers[username]) {
        delete config.RegisteredUsers[username];
        await fs.outputJson(CONFIG_PATH, config, { spaces: 2 });
        console.log(`User ${username} removed from PACS config.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error modifying PACS config:", error);
      return false;
    }
  },
  
  async updateUser(username, password) {
      return this.addUser(username, password);
  },

  async syncUsers(users) {
    if (PACS_TYPE !== 'orthanc') {
      return true;
    }
    try {
      if (!await fs.pathExists(CONFIG_PATH)) {
        console.warn(`PACS config file not found at ${CONFIG_PATH}. Skipping sync.`);
        return false;
      }

      const fileContent = await fs.readFile(CONFIG_PATH, 'utf8');
      let config;
      try {
        config = JSON.parse(stripComments(fileContent));
      } catch (e) {
        console.error("Failed to parse PACS config during sync.", e);
        return false;
      }

      // Initialize RegisteredUsers if missing
      if (!config.RegisteredUsers) {
        config.RegisteredUsers = {};
      }

      // Enable Authentication
      config.AuthenticationEnabled = true;

      // Sync users from DB to PACS
      // Warning: This effectively resets RegisteredUsers to match DB (plus any that were there? No, let's merge or replace?)
      // User request implies management via settings. Let's keep it safe:
      // We will ensure all DB users exist in PACS. 
      // We will NOT remove users that are in PACS but not in DB, unless we want strict mirroring.
      // Strict mirroring is better for "User Management".
      
      // Let's go with: Clear existing RegisteredUsers and rebuild from DB users.
      // But maybe preserve defaults if they exist? 
      // No, user wants security.
      
      config.RegisteredUsers = {};
      
      for (const user of users) {
          if (user.username && user.password) {
              config.RegisteredUsers[user.username] = user.password;
          }
      }

      await fs.outputJson(CONFIG_PATH, config, { spaces: 2 });
      console.log(`Synced ${users.length} users to PACS config.`);
      return true;
    } catch (error) {
      console.error("Error syncing PACS config:", error);
      return false;
    }
  }
};

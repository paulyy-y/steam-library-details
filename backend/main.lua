--[[
    Library Details - Millennium plugin backend.

    Stores settings and the frontend's achievement cache in the plugin folder.
    All Steam data comes from the client itself, so there are no network calls here.
]]

local logger = require("logger")
local millennium = require("millennium")
local json = require("json")
local settings = require("settings")
local paths = require("paths")

local ACHIEVEMENTS_FILE = "achievements.json"

-- Runs fn and returns its JSON result, or a JSON error if it throws.
local function guarded(name, fn)
    local ok, result = pcall(fn)
    if not ok then
        logger:error(name .. " error: " .. tostring(result))
        return json.encode({ success = false, error = tostring(result) })
    end
    return result
end

function GetSettings()
    return guarded("GetSettings", function()
        return json.encode({ success = true, data = settings.load() })
    end)
end

function SaveSettings(settings_json)
    return guarded("SaveSettings", function()
        local parsed = json.decode(settings_json)
        if type(parsed) ~= "table" then
            return json.encode({ success = false, error = "Invalid settings" })
        end
        if not settings.save(settings.merge_defaults(parsed)) then
            return json.encode({ success = false, error = "Failed to write settings file" })
        end
        return json.encode({ success = true })
    end)
end

-- The cache is the frontend's own JSON; it is stored as-is.
function LoadAchievements()
    return guarded("LoadAchievements", function()
        local file = io.open(paths.data_file(ACHIEVEMENTS_FILE), "r")
        if not file then
            return json.encode({ success = true, data = "{}" })
        end
        local content = file:read("*a")
        file:close()
        return json.encode({ success = true, data = content })
    end)
end

function SaveAchievements(cache_json)
    return guarded("SaveAchievements", function()
        local ok, parsed = pcall(json.decode, cache_json)
        if not ok or type(parsed) ~= "table" then
            return json.encode({ success = false, error = "Invalid cache" })
        end
        local file, err = io.open(paths.data_file(ACHIEVEMENTS_FILE), "w")
        if not file then
            return json.encode({ success = false, error = tostring(err) })
        end
        file:write(cache_json)
        file:close()
        return json.encode({ success = true })
    end)
end

-- Frontend diagnostics into this plugin's log file.
function Log(message)
    logger:info(tostring(message))
    return json.encode({ success = true })
end

local function on_load()
    logger:info("Library Details loaded, Millennium " .. millennium.version())
    logger:info("Data folder: " .. paths.plugin_dir())
    millennium.ready()
end

local function on_frontend_loaded()
    logger:info("Library Details: frontend loaded")
end

local function on_unload()
    logger:info("Library Details unloaded")
end

return {
    on_load = on_load,
    on_frontend_loaded = on_frontend_loaded,
    on_unload = on_unload,
    GetSettings = GetSettings,
    SaveSettings = SaveSettings,
    LoadAchievements = LoadAchievements,
    SaveAchievements = SaveAchievements,
    Log = Log,
}

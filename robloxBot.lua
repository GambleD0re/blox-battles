-- Polyfill for environments missing table.pack/unpack
if not table.pack then function table.pack(...) return { n = select("#", ...), ... } end end
if not table.unpack then table.unpack = unpack or function(t, i, j) i = i or 1; j = j or t.n or #t; return unpack(t, i, j) end end

--[[
    Global Duel Logger (Batched JSON Event Stream)
    Version: 26.0.0 (Production Release)
    Date: 2025-08-16
    
    Features:
    - Hybrid hooking model for maximum stability.
    - Late-binding of fighter events to prevent log contamination.
    - Real-time, event-driven inventory/loadout tracking.
    - Precise damage tracking via health change monitoring.
    - Standoff resolution via queue pad detection.
    - Real-time banned map & weapon vote enforcement.
    - Automated kicking for unauthorized players and post-duel cleanup.
    - Mid-duel disconnect/rage-quit detection.
    - Detailed duel transcript generation for backend processing.
    - [NEW] Anti-AFK (Autokick Protection).
    - [NEW] Self-termination via client freeze upon being kicked.
]]

--// Services & Configuration \\--
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")
local VirtualUser = game:GetService("VirtualUser") -- [[ NEW ]] Service for Anti-AFK

-- Server Identification
local BOT_LOCATION = "NA-East"
local SERVER_NUMBER = 1
local ROBLOX_PLACE_ID = 17625359962
local MANUAL_PRIVATE_SERVER_LINK = ""

-- API & Backend Configuration
local BOT_API_KEY = "YOUR_SECRET_BOT_API_KEY"
local BACKEND_API_BASE_URL = "https://blox-battles-backend.onrender.com/api"

-- Timing & Batching Configuration
local GHOST_SPECTATE_CYCLE_DELAY = 1
local EVENT_BATCH_SIZE = 10
local EVENT_BATCH_TIMEOUT = 5
local TASK_FETCH_INTERVAL = 5
local HEARTBEAT_INTERVAL = 20
local ANTI_AFK_INTERVAL = 120 -- [[ NEW ]] 2 minutes

-- Feature Toggles
local KICK_PARTICIPANTS_AFTER_DUEL = true
local KICK_UNAUTHORIZED_PLAYERS = true
local ENABLE_DISCONNECT_FORFEIT = true
local UNAUTHORIZED_KICK_GRACE_PERIOD = 10

-- Game-Specific Constants
local WINNING_SCORE = 5
local SCRIPT_VERSION = "26.0.0"
local VOTE_EVENT_KEY = string.char(127)

--// Enable Localhost Requests for Executors \\--
pcall(function() if syn and syn.request and getgenv then getgenv().syn.request = syn.request; print("Logger: Synapse request function override enabled.") elseif http_request and getgenv then getgenv().http_request = http_request; print("Logger: Generic http_request function override enabled.") end end)

--// Script State \\--
local LocalPlayer = Players.LocalPlayer
local DuelController, SpectateController, QueuePadController
local trackedDuels = {}
local eventBuffer = {}
local activeTasks = {}
local padStates = {}
local serverId = BOT_LOCATION .. "_" .. tostring(SERVER_NUMBER)

--// Helper Functions \\--
local function makeHttpRequest(requestData) local s,r; if syn and syn.request then s,r=pcall(syn.request,requestData) elseif http_request then s,r=pcall(http_request,requestData) else s,r=pcall(request,requestData) end; if not s then warn("Bot: HTTP request failed. Error:",r) return false,nil end; return true,r end
local function safeHookMethod(o, m, f) if typeof(o)~="table" then return end; local t=getmetatable(o); if not t or not t.__index or typeof(t.__index[m])~="function" then return end; local g=t.__index[m]; t.__index[m]=function(e,...) local a=table.pack(...); pcall(function() f(e,table.unpack(a,1,a.n)) end); return g(e,table.unpack(a,1,a.n)) end end
local function hybridConnect(connectionsTable, signal, func) if typeof(signal) == "RBXScriptSignal" then table.insert(connectionsTable, signal:Connect(func)) else safeHookMethod(signal, "Fire", function(_, ...) func(...) end) end end
local function kickPlayer(p) if not p then return end; local r=ReplicatedStorage:FindFirstChild("Remotes",true) and ReplicatedStorage.Remotes.PrivateServer and ReplicatedStorage.Remotes.PrivateServer:FindFirstChild("KickPlayer"); if not r then warn("Kick failed: No remote.") return end; print("Bot: Kicking "..p.Name); pcall(r.FireServer,r,p) end

--// Webhook & Event Buffering System \\--
local function sendBatch() if #eventBuffer==0 then return end; local b=table.clone(eventBuffer); eventBuffer={}; local s,p=pcall(HttpService.JSONEncode,HttpService,b); if not s then warn("Bot: JSONEncode fail:",p) return end; makeHttpRequest({Url=BACKEND_API_BASE_URL.."/log",Method="POST",Headers={["Content-Type"]="application/json",["X-API-Key"]=BOT_API_KEY},Body=p}) end
local function sendEvent(id,type,data) table.insert(eventBuffer,{duelId=id,timestamp=os.date("!%Y-%m-%dT%H:%M:%SZ"),eventType=type,data=data or {}}); if #eventBuffer>=EVENT_BATCH_SIZE then sendBatch() end end

--// Backend Communication \\--
local function sendHeartbeat() local l; if MANUAL_PRIVATE_SERVER_LINK and MANUAL_PRIVATE_SERVER_LINK~="" then l=MANUAL_PRIVATE_SERVER_LINK else l="https://www.roblox.com/games/start?placeId="..tostring(ROBLOX_PLACE_ID).."&gameId="..game.JobId end; local p=HttpService:JSONEncode({serverId=serverId,joinLink=l}); local r={Url=BACKEND_API_BASE_URL.."/status/heartbeat",Method="POST",Headers={["Content-Type"]="application/json",["X-API-Key"]=BOT_API_KEY},Body=p}; local s,res=makeHttpRequest(r); if not s or not res or res.StatusCode~=200 then warn("Bot: Heartbeat fail for "..serverId) end end
local function fetchAndProcessTasks() local r={Url=BACKEND_API_BASE_URL.."/tasks/"..serverId,Method="GET",Headers={["X-API-Key"]=BOT_API_KEY}}; local s,res=makeHttpRequest(r); if not s or not res or res.StatusCode~=200 then warn("Bot: Task fetch fail for "..serverId); return end; local d,t=pcall(HttpService.JSONDecode,HttpService,res.Body); if not d or typeof(t)~="table" then warn("Bot: Task decode fail:",res.Body); return end; for _,task in ipairs(t) do if task.task_type=="REFEREE_DUEL" then local p=task.payload; if p and p.websiteDuelId and not activeTasks[p.websiteDuelId] then print("Bot: Received task:",p.websiteDuelId); activeTasks[p.websiteDuelId]=task end end end end
local function markTaskComplete(id) if not id then return end; print("Bot: Marking task",id,"complete."); local r={Url=BACKEND_API_BASE_URL.."/tasks/"..id.."/complete",Method="POST",Headers={["X-API-Key"]=BOT_API_KEY}}; makeHttpRequest(r) end
local function confirmDuelMatch(id) if not id then return end; print("Bot: Duel",id,"matched. Confirming."); local r={Url=BACKEND_API_BASE_URL.."/duels/"..tostring(id).."/bot-confirm",Method="POST",Headers={["X-API-Key"]=BOT_API_KEY}}; makeHttpRequest(r) end

--// Core Duel Tracking & Hooking Logic \\--
local function hookFighterEvents(dueler, duelState)
    if not (dueler and dueler.Player and dueler.ClientFighter) or dueler._fighterHooked then return end
    dueler._fighterHooked = true
    
    safeHookMethod(dueler.ClientFighter, "ReplicateFromServer", function(self, event, ...)
        if self ~= dueler.ClientFighter then return end
        local args = {...}
        if event == "DataValueChanged" and args[1] == "_" and typeof(args[2]) == "table" then
            local currentLoadout = args[2]
            sendEvent(duelState.id, "PARSED_LOADOUT_UPDATE", { playerName = dueler.Player.Name, loadout = currentLoadout })
            -- Banned Weapon Check
            if duelState.bannedWeapons and #duelState.bannedWeapons > 0 then
                for _, bannedWeaponName in ipairs(duelState.bannedWeapons) do
                    if table.find(currentLoadout, bannedWeaponName) then
                        warn("Banned item detected! Player:", dueler.Player.Name, "equipped:", bannedWeaponName)
                        local winner = nil
                        for _, d in ipairs(duelState.duel.Duelers) do if d.Player and d.Player ~= dueler.Player then winner = d.Player; break end end
                        if winner then
                            sendEvent(duelState.id, "PARSED_DUEL_ENDED", { winner_username = winner.Name, forfeit_reason = "Equipped a banned item: " .. bannedWeaponName })
                            markTaskComplete(duelState.taskId); untrackDuel(duelState.duel)
                        end
                        break
                    end
                end
            end
        elseif event == "EliminationEffect" then
            sendEvent(duelState.id, "ELIMINATION", { victim = dueler.Player.Name, killer = args[1] and args[1].Name or "Environment", weapon = args[3] or "Unknown" })
        end
    end)
end

local function hookDueler(dueler, duelState)
    if not (dueler and dueler.Player) then return end
    local playerName = dueler.Player.Name
    duelState.playerStates[playerName] = { lastKnownHealth = dueler:GetHealth() }
    sendEvent(duelState.id, "PLAYER_JOINED_DUEL", { playerName = playerName })

    hybridConnect(duelState.connections, dueler.HealthChanged, function(newHealth) local ps=duelState.playerStates[playerName]; if not ps or newHealth == ps.lastKnownHealth then return end; local old=ps.lastKnownHealth; if newHealth<old then sendEvent(duelState.id,"DAMAGE_DEALT",{victim=playerName,damage=old-newHealth}) end; ps.lastKnownHealth=newHealth end)
    hybridConnect(duelState.connections, dueler.Died, function() sendEvent(duelState.id, "PLAYER_DIED", { player = playerName }); sendEvent(duelState.id, "DEATH_SNAPSHOT", { player = playerName, state = dueler.Data }) end)
    hybridConnect(duelState.connections, dueler:GetDataChangedSignal("LastVote"), function() local vote = dueler:Get("LastVote"); if vote then duelState.votes[playerName] = vote; sendEvent(duelState.id, "PLAYER_VOTED_MAP", {playerName = playerName, map = vote}) end end)
end

function untrackDuel(duel) local s=trackedDuels[duel]; if not s then return end; for _,c in ipairs(s.connections) do if typeof(c.Disconnect) == "function" then pcall(c.Disconnect, c) end end; trackedDuels[duel]=nil; print("Bot: Stopped tracking duel",s.id) end

function trackDuel(duel, websiteDuelId, taskId, taskPayload)
    if trackedDuels[duel] then return end
    local state={id=websiteDuelId,taskId=taskId,duel=duel,connections={},playerStates={},votes={},bannedWeapons=taskPayload.bannedWeapons or {},bannedMap=taskPayload.banned_map or nil}; trackedDuels[duel]=state; print("Bot: Now tracking duel",websiteDuelId)
    
    safeHookMethod(duel,"ReplicateFromServer",function(s,e,...) if s~=duel then return end; if e=="RoundStarting" then local a={...}; sendEvent(websiteDuelId,"ROUND_STARTING",{d=a[1],s=a[2]}) elseif e=="RoundFinish" then local a={...}; sendEvent(websiteDuelId,"ROUND_FINISH",{w=a[1]}) end end)
    
    hybridConnect(state.connections, duel.DuelerAdded, function(d) pcall(hookDueler,d,state) end)
    hybridConnect(state.connections, duel.MapAdded, function(map)
        local chosenMapName = map.Name
        if state.bannedMap and chosenMapName:lower() == state.bannedMap:lower() then
            print("Bot: Banned map '"..chosenMapName.."' chosen for duel "..websiteDuelId); local forfeiter,winner=nil,nil
            for p,v in pairs(state.votes) do if v:lower()==chosenMapName:lower() then forfeiter=p; break end end
            if forfeiter then for _,d in ipairs(duel.Duelers) do if d.Player and d.Player.Name~=forfeiter then winner=d.Player.Name; break end end
                if winner then sendEvent(websiteDuelId,"PARSED_DUEL_ENDED",{winner_username=winner,forfeit_reason="Voted for the banned map: "..chosenMapName}); markTaskComplete(taskId); untrackDuel(duel); return end
            end
        end
        confirmDuelMatch(websiteDuelId); sendEvent(websiteDuelId,"DUEL_STARTED",{map=chosenMapName}); for _,d in ipairs(duel.Duelers) do pcall(hookDueler,d,state); pcall(hookFighterEvents,d,state) end
    end)
    hybridConnect(state.connections, duel:GetDataChangedSignal("Scores"), function() sendEvent(websiteDuelId,"SCORE_UPDATE",{scores=duel:Get("Scores")}) end)
    hybridConnect(state.connections, duel:GetDataChangedSignal("Status"), function() 
        local status = duel:Get("Status")
        if status == "RoundStarting" then for _, d in ipairs(duel.Duelers) do pcall(hookFighterEvents,d,state) end end
        if status == "GameOver" then
            local winnerUsername = nil; local scores = duel:Get("Scores") or {}; if scores then for teamId, score in pairs(scores) do if score >= WINNING_SCORE then for _, dueler in ipairs(duel.Duelers) do if dueler:Get("TeamID") == teamId and dueler.Player then winnerUsername = dueler.Player.Name; break end end; break end end end
            sendEvent(websiteDuelId, "PARSED_DUEL_ENDED", { winner_username = winnerUsername, finalScores = scores })
            markTaskComplete(taskId)
            if KICK_PARTICIPANTS_AFTER_DUEL then task.delay(3, function() for _,d in ipairs(duel.Duelers) do if d.Player then pcall(kickPlayer,d.Player) end end end) end
            untrackDuel(duel)
        end 
    end)
    for _,d in ipairs(duel.Duelers) do pcall(hookDueler,d,state) end
end

--// Initialization & Main Loops \\--
local function loadControllersAndModules() local p=LocalPlayer:WaitForChild("PlayerScripts",15); if not p then warn("Logger Error: PlayerScripts not found."); return false end; while not(DuelController and SpectateController and QueuePadController) do pcall(function() local c=p:FindFirstChild("Controllers"); if c then if not DuelController then DuelController=require(c.DuelController) end; if not SpectateController then SpectateController=require(c.SpectateController) end; if not QueuePadController then QueuePadController=require(c.QueuePadController) end end end); if not(DuelController and SpectateController and QueuePadController) then task.wait(1) end end; return true end

if loadControllersAndModules() then
    if DuelController._loggerInitialized then warn("Logger already initialized."); return end
    DuelController._loggerInitialized = true; print("Global Duel Logger (v" .. SCRIPT_VERSION .. ") Initialized for server: " .. serverId)
    
    DuelController.ObjectAdded:Connect(function(d) local n={}; for _,p in ipairs(d.Duelers) do if p.Player then table.insert(n,p.Player.Name:lower()) end end; if #n<2 then return end; for id,t in pairs(activeTasks) do local pay=t.payload; if(table.find(n,pay.challenger:lower()) and table.find(n,pay.opponent:lower())) then print("Bot: Matched duel:",id); trackDuel(d,id,t.id,pay); activeTasks[id]=nil; return end end end)
    DuelController.ObjectRemoved:Connect(untrackDuel)
    
    local function hookQueuePad(pad) if not (pad and pad:Get("QueueName") and string.find(pad:Get("QueueName"):lower(), "1v1")) then return end; padStates[pad] = {lastPlayerIds=""}; local signal=pad:GetDataChangedSignal("PlayersWaiting"); hybridConnect({},signal,function() local playersWaiting=pad:Get("PlayersWaiting") or {}; local playerIdsOnPad={}; for _,t in pairs(playersWaiting) do for id,_ in pairs(t) do table.insert(playerIdsOnPad,id) end end; table.sort(playerIdsOnPad); local currentIds=table.concat(playerIdsOnPad,","); if currentIds~=padStates[pad].lastPlayerIds then local playerNames={}; for _,id in ipairs(playerIdsOnPad) do local p=Players:GetPlayerByUserId(id); if p then for webId,task in pairs(activeTasks) do local pay=task.payload; if p.Name:lower()==pay.challenger:lower() or p.Name:lower()==pay.opponent:lower() then sendEvent(webId,"PLAYER_DECLARED_READY_ON_PAD",{playerName=p.Name}); break end end end end; padStates[pad].lastPlayerIds=currentIds end end) end
    QueuePadController.ObjectAdded:Connect(hookQueuePad)
    for _,pad in pairs(QueuePadController.Objects) do pcall(hookQueuePad,pad) end
    
    Players.PlayerAdded:Connect(function(p) sendEvent("SERVER_WIDE", "PLAYER_JOINED_SERVER", { playerName = p.Name }); if not KICK_UNAUTHORIZED_PLAYERS then return end; task.delay(UNAUTHORIZED_KICK_GRACE_PERIOD,function() if not p or not p.Parent then return end; for _,s in pairs(trackedDuels) do for _,d in ipairs(s.duel.Duelers) do if d.Player==p then return end end end; local a=false; for _,t in pairs(activeTasks) do local pay=t.payload; if p.Name:lower()==pay.challenger:lower() or p.Name:lower()==pay.opponent:lower() then a=true; break end end; if not a then print("Bot: Kicking unauthorized player "..p.Name); kickPlayer(p) end end) end)
    Players.PlayerRemoving:Connect(function(p)
        sendEvent("SERVER_WIDE", "PLAYER_LEFT_SERVER", { playerName = p.Name })
        if not ENABLE_DISCONNECT_FORFEIT then return end
        for duel, state in pairs(trackedDuels) do
            if duel:Get("Status") == "in_progress" or duel:Get("Status") == "RoundStarted" then
                local leavingDueler = nil
                for _, dueler in ipairs(duel.Duelers) do if dueler.Player == p then leavingDueler = dueler; break end end
                if leavingDueler then
                    local winner = nil
                    for _, dueler in ipairs(duel.Duelers) do if dueler.Player ~= p then winner = dueler.Player; break end end
                    if winner then
                        print("Bot: Player " .. p.Name .. " disconnected mid-duel.")
                        sendEvent(state.id, "PARSED_DUEL_ENDED", { winner_username = winner.Name, forfeit_reason = "Opponent disconnected." })
                        markTaskComplete(state.taskId); untrackDuel(duel)
                        return
                    end
                end
            end
        end
    end)
    
    -- [[ NEW ]] Kick/Disconnect Self-Termination
    LocalPlayer.AncestryChanged:Connect(function(_, parent)
        if parent == nil then
            warn("Bot: KICKED or DISCONNECTED. Terminating instance by freezing.")
            -- This infinite loop will cause the script to hang, making the client unresponsive.
            -- The external manager will detect this via a failed API ping.
            while true do
                task.wait(1)
            end
        end
    end)

    task.spawn(function() while true do task.wait(EVENT_BATCH_TIMEOUT); sendBatch() end end)
    task.spawn(function() while true do task.wait(TASK_FETCH_INTERVAL); fetchAndProcessTasks() end end)
    task.spawn(function() while true do task.wait(HEARTBEAT_INTERVAL); sendHeartbeat() end end)
    task.spawn(function() local i=1; while true do task.wait(GHOST_SPECTATE_CYCLE_DELAY); local d={}; for k in pairs(trackedDuels) do table.insert(d,k) end; if #d>0 then i=(i%#d)+1; local t=d[i]; if t and trackedDuels[t] and t.Duelers[1] and t.Duelers[1].ClientFighter then pcall(SpectateController.SetCurrentSubject,SpectateController,t.Duelers[1].ClientFighter,true) end end end end)
    
    -- [[ NEW ]] Anti-AFK Protection
    task.spawn(function()
        while true do
            task.wait(ANTI_AFK_INTERVAL)
            pcall(function()
                -- Simulate a brief mouse click to prevent being kicked for idling
                VirtualUser:Button1Down(Vector2.new(0, 0))
                task.wait(0.1)
                VirtualUser:Button1Up(Vector2.new(0, 0))
                print("Bot: Anti-AFK simulated input.")
            end)
        end
    end)

else
    warn("Global Tracker failed to initialize.")
end

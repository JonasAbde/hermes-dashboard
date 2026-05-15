var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// api/routes/lib/service-manager.ts — Unified service management
// Shared between CLI and API
import { writeFileSync, readFileSync as readFile, existsSync } from 'fs';
import { join } from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
var execAsync = promisify(exec);
var HOME_DIR = process.env.HOME || require('os').homedir();
var HERMES = join(HOME_DIR, '.hermes');
var HERMES_ROOT = HERMES;
var HERMES_BIN = join(HOME_DIR, '.local/bin/hermes');
var PID_DIR = join(HERMES, '.pids');
// Service names matching systemd units
var SERVICE_NAMES = {
    api: 'hermes-dashboard-api.service',
    web: 'hermes-dashboard-web.service',
    proxy: 'hermes-dashboard-proxy.service',
    tunnel: 'hermes-dashboard-tunnel.service',
    gateway: 'hermes-gateway.service',
};
// API ports for web scraping
var SERVICE_PORTS = {
    api: 5174,
    web: 5175,
    proxy: 5176,
    gateway: 8642,
};
// ── PID file management ─────────────────────────────────────────────────────
export function getPidDir() {
    if (!existsSync(PID_DIR)) {
        try {
            writeFileSync(PID_DIR, '');
        }
        catch (_a) { }
    }
    return PID_DIR;
}
export function readPidFile(service) {
    try {
        var file = join(getPidDir(), "".concat(service, ".pid"));
        var raw = readFile(file, 'utf8').trim();
        return parseInt(raw, 10);
    }
    catch (_a) {
        return null;
    }
}
export function writePidFile(service, pid) {
    var pidDir = getPidDir();
    writeFileSync(join(pidDir, "".concat(service, ".pid")), String(pid));
}
export function cleanPidFile(service) {
    try {
        var file = join(getPidDir(), "".concat(service, ".pid"));
        if (existsSync(file)) {
            writeFileSync(file, '');
        }
    }
    catch (_a) { }
}
// ── Process detection ───────────────────────────────────────────────────────
export function isPidAlive(pid) {
    try {
        // kill 0 checks if process exists without killing
        process.kill(pid, 0);
        return true;
    }
    catch (_a) {
        return false;
    }
}
export function getProcessCmdline(pid) {
    try {
        var stat = readFile("/proc/".concat(pid, "/stat"), 'utf8');
        var match = stat.match(/^\d+\s+\(([^)]+)\)\s+\w+/);
        return match ? match[1] : null;
    }
    catch (_a) {
        return null;
    }
}
// ── Systemctl wrapper ──────────────────────────────────────────────────────
export function systemctl(action, unit) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, envName, _a, stdout, stderr, status, uptime, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    startTime = Date.now();
                    envName = process.env.HERMES_ENV || 'development';
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, execAsync("systemctl --user --no-pager ".concat(action, " ").concat(unit, " 2>&1"), { timeout: 30000 })];
                case 2:
                    _a = _b.sent(), stdout = _a.stdout, stderr = _a.stderr;
                    return [4 /*yield*/, systemctlIsAlive(unit)];
                case 3:
                    status = _b.sent();
                    return [4 /*yield*/, systemctlGetUptime(unit)];
                case 4:
                    uptime = _b.sent();
                    console.log("[service-manager] systemctl ".concat(action, " ").concat(unit, " [").concat(envName, "]: success (").concat(Date.now() - startTime, "ms)"));
                    return [2 /*return*/, {
                            success: true,
                            applied: true,
                            service: unit,
                            status: 'ok',
                            source: 'systemctl',
                            updated_at: new Date().toISOString(),
                            service_status: {
                                key: unit,
                                label: unit,
                                unit: unit,
                                port: 0,
                                active: status,
                                state: status ? 'active' : 'inactive',
                                substate: 'running',
                                pid: null,
                                uptime_s: uptime,
                                cmdline: null,
                            },
                        }];
                case 5:
                    error_1 = _b.sent();
                    console.error("[service-manager] systemctl ".concat(action, " ").concat(unit, " failed: ").concat(error_1.message));
                    return [2 /*return*/, {
                            success: false,
                            applied: false,
                            service: unit,
                            status: 'error',
                            source: 'systemctl',
                            updated_at: new Date().toISOString(),
                            error: error_1.message,
                        }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
export function systemctlIsAlive(unit) {
    return __awaiter(this, void 0, void 0, function () {
        var stdout, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, execAsync("systemctl --user is-active --quiet ".concat(unit), { timeout: 5000 })];
                case 1:
                    stdout = (_b.sent()).stdout;
                    return [2 /*return*/, stdout.trim() === 'active'];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
export function systemctlGetUptime(unit) {
    return __awaiter(this, void 0, void 0, function () {
        var stdout, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, execAsync("systemctl --user show ".concat(unit, " -p ActiveEnterTimestamp --value"), { timeout: 5000 })];
                case 1:
                    stdout = (_b.sent()).stdout;
                    return [2 /*return*/, stdout.trim() || null];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// ── Service status (unified) ─────────────────────────────────────────────────
export function getServiceStatus(key) {
    return __awaiter(this, void 0, void 0, function () {
        var unit, pidData, cmdline, _a, activeState, subState, pid, error_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    unit = SERVICE_NAMES[key] || key;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    if (key === 'gateway') {
                        pidData = readPidFile('gateway');
                        if (pidData && isPidAlive(pidData)) {
                            cmdline = getProcessCmdline(pidData);
                            return [2 /*return*/, {
                                    key: key,
                                    label: 'Hermes Gateway',
                                    unit: unit,
                                    port: SERVICE_PORTS.gateway,
                                    active: true,
                                    state: 'active',
                                    substate: 'running',
                                    pid: pidData,
                                    uptime_s: null,
                                    cmdline: cmdline,
                                }];
                        }
                    }
                    return [4 /*yield*/, Promise.all([
                            systemctlIsAlive(unit),
                            execAsync("systemctl --user show ".concat(unit, " -p SubState --value"), { timeout: 5000 })
                                .then(function (r) { return r.stdout.trim(); })
                                .catch(function () { return 'unknown'; })
                        ])];
                case 2:
                    _a = _b.sent(), activeState = _a[0], subState = _a[1];
                    return [4 /*yield*/, systemctlGetPid(unit)];
                case 3:
                    pid = _b.sent();
                    return [2 /*return*/, {
                            key: key,
                            label: key,
                            unit: unit,
                            port: SERVICE_PORTS[key] || 0,
                            active: activeState,
                            state: activeState ? 'active' : 'inactive',
                            substate: subState,
                            pid: pid,
                            uptime_s: null,
                            cmdline: null,
                        }];
                case 4:
                    error_2 = _b.sent();
                    return [2 /*return*/, {
                            key: key,
                            label: key,
                            unit: unit,
                            port: SERVICE_PORTS[key] || 0,
                            active: false,
                            state: 'unknown',
                            substate: 'unknown',
                            pid: null,
                            uptime_s: null,
                            cmdline: null,
                        }];
                case 5: return [2 /*return*/];
            }
        });
    });
}
export function getAllServicesStatus() {
    return __awaiter(this, void 0, void 0, function () {
        var services, _i, _a, key, status;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    services = {};
                    _i = 0, _a = Object.keys(SERVICE_NAMES);
                    _b.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    key = _a[_i];
                    return [4 /*yield*/, getServiceStatus(key)];
                case 2:
                    status = _b.sent();
                    services[key] = status;
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, services];
            }
        });
    });
}
// ── Service control (unified) ───────────────────────────────────────────────
export function controlService(key, action) {
    return __awaiter(this, void 0, void 0, function () {
        var unit;
        return __generator(this, function (_a) {
            unit = SERVICE_NAMES[key];
            if (!unit) {
                return [2 /*return*/, {
                        success: false,
                        applied: false,
                        service: key,
                        status: 'error',
                        source: 'runtime',
                        updated_at: new Date().toISOString(),
                        error: "Unknown service: ".concat(key),
                    }];
            }
            if (key === 'gateway') {
                // Gateway uses custom control logic
                return [2 /*return*/, controlGatewayService(action)];
            }
            // Stop gateway separately (when stopping all)
            if (action === 'stop' && key === 'gateway') {
                // Don't stop gateway when stopping dashboard services
                return [2 /*return*/, {
                        success: true,
                        applied: false,
                        service: key,
                        status: 'not_supported',
                        source: 'runtime',
                        updated_at: new Date().toISOString(),
                        error: 'Gateway should be controlled separately',
                    }];
            }
            return [2 /*return*/, systemctl(action, unit)];
        });
    });
}
export function startServices(keys) {
    return __awaiter(this, void 0, void 0, function () {
        var started, _i, keys_1, key, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    started = [];
                    _i = 0, keys_1 = keys;
                    _a.label = 1;
                case 1:
                    if (!(_i < keys_1.length)) return [3 /*break*/, 4];
                    key = keys_1[_i];
                    return [4 /*yield*/, controlService(key, 'start')];
                case 2:
                    result = _a.sent();
                    if (result.success) {
                        started.push(key);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, started];
            }
        });
    });
}
export function stopServices(keys) {
    return __awaiter(this, void 0, void 0, function () {
        var stopped, _i, keys_2, key, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stopped = [];
                    _i = 0, keys_2 = keys;
                    _a.label = 1;
                case 1:
                    if (!(_i < keys_2.length)) return [3 /*break*/, 4];
                    key = keys_2[_i];
                    return [4 /*yield*/, controlService(key, 'stop')];
                case 2:
                    result = _a.sent();
                    if (result.success) {
                        stopped.push(key);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, stopped];
            }
        });
    });
}
export function restartServices(keys) {
    return __awaiter(this, void 0, void 0, function () {
        var restarted, _i, keys_3, key, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    restarted = [];
                    _i = 0, keys_3 = keys;
                    _a.label = 1;
                case 1:
                    if (!(_i < keys_3.length)) return [3 /*break*/, 4];
                    key = keys_3[_i];
                    return [4 /*yield*/, controlService(key, 'restart')];
                case 2:
                    result = _a.sent();
                    if (result.success) {
                        restarted.push(key);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, restarted];
            }
        });
    });
}
// ── Gateway special handling ─────────────────────────────────────────────────
export function controlGatewayService(action) {
    return __awaiter(this, void 0, void 0, function () {
        var startTime, status_1, sleep, status, pid, uptime, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 14, , 15]);
                    if (!(action === 'stop')) return [3 /*break*/, 4];
                    return [4 /*yield*/, execAsync("systemctl --user stop hermes-gateway.service 2>&1", { timeout: 30000 })];
                case 2:
                    _a.sent();
                    cleanPidFile('gateway');
                    console.log("[service-manager] gateway ".concat(action, " [").concat(process.env.HERMES_ENV || 'development', "]: success"));
                    return [4 /*yield*/, systemctlIsAlive('hermes-gateway.service')];
                case 3:
                    status_1 = _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            applied: true,
                            service: 'hermes-gateway.service',
                            status: 'ok',
                            source: 'systemctl',
                            updated_at: new Date().toISOString(),
                            service_status: {
                                key: 'gateway',
                                label: 'Hermes Gateway',
                                unit: 'hermes-gateway.service',
                                port: SERVICE_PORTS.gateway,
                                active: !status_1,
                                state: 'inactive',
                                substate: 'dead',
                                pid: null,
                                uptime_s: null,
                                cmdline: null,
                            },
                        }];
                case 4: 
                // Start and restart for gateway
                return [4 /*yield*/, execAsync("systemctl --user reset-failed hermes-gateway.service >/dev/null 2>&1 || true", { timeout: 5000 })];
                case 5:
                    // Start and restart for gateway
                    _a.sent();
                    return [4 /*yield*/, execAsync("systemctl --user ".concat(action, " hermes-gateway.service 2>&1"), { timeout: 30000 })];
                case 6:
                    _a.sent();
                    sleep = function (ms) { return new Promise(function (resolve) { return setTimeout(resolve, ms); }); };
                    if (!(action === 'start')) return [3 /*break*/, 8];
                    return [4 /*yield*/, sleep(2500)];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 10];
                case 8: return [4 /*yield*/, sleep(1200)];
                case 9:
                    _a.sent();
                    _a.label = 10;
                case 10: return [4 /*yield*/, systemctlIsAlive('hermes-gateway.service')];
                case 11:
                    status = _a.sent();
                    if ((action === 'stop' && status) || (action !== 'stop' && !status)) {
                        throw new Error("Gateway state mismatch: expected ".concat(action === 'stop' ? 'inactive' : 'active', ", got ").concat(status));
                    }
                    return [4 /*yield*/, systemctlGetPid('hermes-gateway.service')];
                case 12:
                    pid = _a.sent();
                    if (pid) {
                        writePidFile('gateway', pid);
                    }
                    return [4 /*yield*/, systemctlGetUptime('hermes-gateway.service')];
                case 13:
                    uptime = _a.sent();
                    console.log("[service-manager] gateway ".concat(action, " [").concat(process.env.HERMES_ENV || 'development', "]: success"));
                    return [2 /*return*/, {
                            success: true,
                            applied: true,
                            service: 'hermes-gateway.service',
                            status: 'ok',
                            source: 'systemctl',
                            updated_at: new Date().toISOString(),
                            service_status: {
                                key: 'gateway',
                                label: 'Hermes Gateway',
                                unit: 'hermes-gateway.service',
                                port: SERVICE_PORTS.gateway,
                                active: status,
                                state: status ? 'active' : 'inactive',
                                substate: 'running',
                                pid: pid,
                                uptime_s: uptime,
                                cmdline: getProcessCmdline(pid),
                            },
                        }];
                case 14:
                    error_3 = _a.sent();
                    console.error("[service-manager] gateway ".concat(action, " failed: ").concat(error_3.message));
                    return [2 /*return*/, {
                            success: false,
                            applied: false,
                            service: 'hermes-gateway.service',
                            status: 'error',
                            source: 'systemctl',
                            updated_at: new Date().toISOString(),
                            error: error_3.message,
                        }];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// ── Legacy helpers for backward compatibility ───────────────────────────────
export function systemctlLegacy(action, service) {
    var _a, _b;
    try {
        execSync("systemctl --user ".concat(action, " ").concat(service), { stdio: 'pipe' });
        return { success: true, error: null };
    }
    catch (e) {
        var error = ((_a = e.stderr) === null || _a === void 0 ? void 0 : _a.toString().trim()) || ((_b = e.stdout) === null || _b === void 0 ? void 0 : _b.toString().trim()) || e.message;
        console.error("[service-manager] systemctl ".concat(action, " ").concat(service, " failed: ").concat(error));
        return { success: false, error: error };
    }
}
export function startService(service) {
    return systemctlLegacy('start', SERVICE_NAMES[service] || service);
}
export function stopService(service) {
    return systemctlLegacy('stop', SERVICE_NAMES[service] || service);
}
export function restartService(service) {
    return systemctlLegacy('restart', SERVICE_NAMES[service] || service);
}
export function isActive(service) {
    try {
        execSync("systemctl --user is-active --quiet ".concat(SERVICE_NAMES[service] || service), { stdio: 'pipe' });
        return true;
    }
    catch (_a) {
        return false;
    }
}
export function getPid(service) {
    try {
        var out = execSync("systemctl --user show -p MainPID --value ".concat(SERVICE_NAMES[service] || service), {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        return out && out !== '0' ? parseInt(out, 10) : null;
    }
    catch (_a) {
        return null;
    }
}
// ── Exports ────────────────────────────────────────────────────────────────
export { HOME_DIR, HERMES, HERMES_ROOT, HERMES_BIN, SERVICE_NAMES, SERVICE_PORTS, PID_DIR, };

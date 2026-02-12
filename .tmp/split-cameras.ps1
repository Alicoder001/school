$srcPath = "src/modules/cameras/presentation/cameras.routes.ts"
$lines = Get-Content $srcPath

$destructure = @"
  const {
    prisma,
    requireCameraAreaSchoolScope,
    requireCameraSchoolScope,
    requireNvrSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    decryptSecret,
    encryptSecret,
    checkNvrHealth,
    probeTcp,
    sanitizeNvr,
    buildRtspUrl,
    fetchOnvifDeviceInfo,
    fetchOnvifProfiles,
    buildMediaMtxConfig,
    getWebrtcPath,
    maskRtspUrl,
    parseRtspUrl,
    MEDIAMTX_DEPLOY_ENABLED,
    MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS,
    ONVIF_CONCURRENCY,
    ONVIF_TIMEOUT_MS,
    WEBRTC_BASE_URL,
    ALLOWED_PROTOCOLS,
    ALLOWED_CAMERA_STATUS,
    badRequest,
    buildWebrtcUrl,
    deployMediaMtxConfig,
    isValidChannelNo,
    toNumber,
    isValidPort,
    isSafeHost,
    isSafeUser,
    isSafeRemotePath,
    isSafeLocalPath,
    isMaskedRtspUrl,
    isSafeRestartCommand,
    buildRtspUrlForCamera,
  } = deps;
"@

function Write-RouteFile($outPath, $fnName, $start, $end) {
  $body = ($lines[($start-1)..($end-1)] -join "`n")
  $content = @"
import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function $fnName(
  fastify: FastifyInstance,
  deps: CamerasHttpDeps,
) {
  type NvrAuth = CamerasNvrAuth;
  type RtspVendor = CamerasRtspVendor;
$destructure
$body
}
"@
  Set-Content -Path $outPath -Value $content
}

Write-RouteFile "src/modules/cameras/interfaces/http/cameras-nvr-crud.routes.ts" "registerCameraNvrCrudRoutes" 279 475
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-nvr-health-sync.routes.ts" "registerCameraNvrHealthAndSyncRoutes" 476 702
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-nvr-onvif.routes.ts" "registerCameraNvrOnvifRoutes" 703 823
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-area.routes.ts" "registerCameraAreaRoutes" 824 928
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-read-stream-config.routes.ts" "registerCameraReadAndStreamRoutes" 929 1120
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-mediamtx-deploy.routes.ts" "registerCameraMediaMtxDeployRoutes" 1121 1344
Write-RouteFile "src/modules/cameras/interfaces/http/cameras-write-test.routes.ts" "registerCameraWriteAndTestRoutes" 1345 1636

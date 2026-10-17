import Foundation
import ServiceManagement
import Security

// Registration controller only. Never reads or exports legacy Agent data.
@main
struct AICCBackupRegistration {
    static let launchdPlist = "com.aicc.agent-only-backup-registrar.plist"

    // Never infer release authority from ad-hoc signing or an arbitrary runtime flag.
    // The Owner-approved Team ID must be embedded BEFORE the final bundle signature.
    static func signedByApprovedTeam() -> Bool {
        guard let approvedTeam = Bundle.main.object(forInfoDictionaryKey: "AICCApprovedTeamID") as? String,
              approvedTeam.range(of: "^[A-Z0-9]{10}$", options: .regularExpression) != nil else { return false }
        var code: SecStaticCode?
        guard SecStaticCodeCreateWithPath(Bundle.main.bundleURL as CFURL, SecCSFlags(), &code) == errSecSuccess,
              let code,
              SecStaticCodeCheckValidity(code, SecCSFlags(), nil) == errSecSuccess else { return false }
        var info: CFDictionary?
        guard SecCodeCopySigningInformation(code, SecCSFlags(rawValue: kSecCSSigningInformation), &info) == errSecSuccess,
              let attrs = info as? [String: Any],
              let actualTeam = attrs[kSecCodeInfoTeamIdentifier as String] as? String else { return false }
        return actualTeam == approvedTeam
    }

    static func label(_ status: SMAppService.Status) -> String {
        switch status {
        case .notRegistered: return "NOT_REGISTERED"
        case .enabled: return "ENABLED_REGISTRATION_ONLY"
        case .requiresApproval: return "REQUIRES_MACOS_OWNER_APPROVAL"
        case .notFound: return "BUNDLE_HELPER_NOT_FOUND"
        @unknown default: return "UNKNOWN_STATUS"
        }
    }

    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        let appBundle = Bundle.main.bundleURL
        guard appBundle.pathExtension == "app" else {
            fputs("ERROR: Run the bundled .app executable; no direct helper invocation.\n", stderr)
            exit(64)
        }
        let service = SMAppService.daemon(plistName: launchdPlist)
        guard args.count == 1 else {
            fputs("Usage: AICCBackupRegistration --status | --register | --open-settings\n", stderr)
            exit(64)
        }
        switch args[0] {
        case "--status":
            print("R2A1_REGISTRATION=\(label(service.status))")
            print("R2A1_EXPORT=DISABLED_NOT_IMPLEMENTED")
            print("R2A_REAL_BACKUP=NO")
        case "--register":
            guard signedByApprovedTeam() else {
                fputs("RELEASE_SIGNER_NOT_ENROLLED: ad-hoc or unapproved app cannot register.\\n", stderr)
                exit(77)
            }
            // Only macOS ServiceManagement performs registration; no direct install.
            do {
                try service.register()
                print("R2A1_REGISTRATION=\(label(service.status))")
                print("R2A1_EXPORT=DISABLED_NOT_IMPLEMENTED")
                print("R2A_REAL_BACKUP=NO")
            } catch {
                fputs("REGISTRATION_FAILED: \(error.localizedDescription)\n", stderr)
                exit(1)
            }
        case "--open-settings":
            SMAppService.openSystemSettingsLoginItems()
            print("MACOS_SYSTEM_SETTINGS_OPENED; manual approval remains required")
        default:
            fputs("ERROR: Unknown action. No install or export performed.\n", stderr)
            exit(64)
        }
    }
}

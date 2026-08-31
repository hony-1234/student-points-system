# PowerShell Script to publish the project to GitHub using gh CLI (without local git.exe)

$repoName = "student-points-system"
$visibility = "--public" # Options: --public, --private

Write-Host "=== 🚀 GITHUB PUBLISHER (NO-GIT MODE) ===" -ForegroundColor Cyan

# 1. Check gh CLI authentication status
$authCheck = & "gh" auth status 2>&1
if ($authCheck -match "You are not logged into any GitHub hosts") {
    Write-Host "❌ Error: You are not logged into GitHub CLI!" -ForegroundColor Red
    Write-Host "👉 Please run the following command in your terminal to login first:" -ForegroundColor Yellow
    Write-Host "   gh auth login" -ForegroundColor White
    exit 1
}

# 2. Get username
$username = & "gh" api user -q .login
if (!$username) {
    Write-Host "❌ Error: Could not retrieve GitHub username." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Authenticated as: $username" -ForegroundColor Green

# 3. Ask for repo confirmation or creation
Write-Host "Creating GitHub repository: $username/$repoName ($visibility)..." -ForegroundColor Cyan
$createRepo = & "gh" repo create $repoName $visibility 2>&1

if ($createRepo -match "already exists") {
    Write-Host "ℹ️ Repository '$username/$repoName' already exists. Uploading files to the existing repository..." -ForegroundColor Yellow
} elseif ($createRepo -match "Created repository") {
    Write-Host "🎉 Successfully created repository: $username/$repoName" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Repository creation response: $createRepo" -ForegroundColor White
}

# 4. Define files to upload
$filesToUpload = @(
    "index.html",
    "styles.css",
    "app.js",
    "dummyData.js",
    "package.json",
    "backdrop.jpg",
    "school_theme_banner.png",
    "pixel_banner_panoramic.png",
    "pixel_rewards_banner.png",
    "2627學生名單.xlsx",
    "credit account.xlsx"
)

# 5. Upload files via GitHub Contents API
$projectDir = "C:\Users\Jerry\.gemini\antigravity\scratch\student-points-system"

foreach ($file in $filesToUpload) {
    $filePath = Join-Path $projectDir $file
    if (Test-Path $filePath) {
        Write-Host "📤 Uploading $file..." -ForegroundColor Cyan
        
        try {
            # Base64 encode the file bytes
            $fileBytes = [IO.File]::ReadAllBytes($filePath)
            $base64Content = [Convert]::ToBase64String($fileBytes)
            
            # Check if file already exists in repository to get its SHA (if updating)
            $sha = ""
            $getSha = & "gh" api "repos/$username/$repoName/contents/$file" --method GET 2>$null | ConvertFrom-Json
            if ($getSha -and $getSha.sha) {
                $sha = $getSha.sha
            }
            
            # Construct parameters for gh api
            if ($sha) {
                # Update file (requires sha)
                & "gh" api --method PUT "repos/$username/$repoName/contents/$file" `
                    -f message="Update $file via Antigravity Publisher" `
                    -f content="$base64Content" `
                    -f sha="$sha" | Out-Null
            } else {
                # Create file
                & "gh" api --method PUT "repos/$username/$repoName/contents/$file" `
                    -f message="Add $file via Antigravity Publisher" `
                    -f content="$base64Content" | Out-Null
            }
            
            Write-Host "✅ Uploaded $file successfully!" -ForegroundColor Green
        }
        catch {
            Write-Host "❌ Failed to upload $file: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️ Warning: File $file not found, skipping." -ForegroundColor Yellow
    }
}

Write-Host "`n🎉 PUBLISH COMPLETE!" -ForegroundColor Green
Write-Host "👉 Your repository is live at: https://github.com/$username/$repoName" -ForegroundColor Yellow

#!/bin/bash

# 多環境建構腳本
# 在本地機器上建構不同環境的前端版本

set -e

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
CLIENT_DIR="./client"
BUILD_OUTPUT_DIR="./builds"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 函數
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# 顯示幫助
show_help() {
    echo "使用方法: $0 [環境]"
    echo ""
    echo "可用環境:"
    echo "  dev         - 開發環境"
    echo "  uat         - UAT測試環境"
    echo "  staging     - Staging預發布環境"
    echo "  production  - 生產環境"
    echo "  all         - 建構所有環境"
    echo ""
    echo "範例:"
    echo "  $0 uat                    # 只建構UAT"
    echo "  $0 production             # 只建構生產環境"
    echo "  $0 all                    # 建構所有環境"
    echo ""
}

# 檢查環境配置文件
check_env_file() {
    local env=$1
    local env_file="$CLIENT_DIR/.env.$env"
    
    if [ ! -f "$env_file" ]; then
        error "找不到配置文件: $env_file"
        info "請從範例文件複製:"
        echo "  cp $CLIENT_DIR/env.$env.example $env_file"
        return 1
    fi
    return 0
}

# 建構特定環境
build_env() {
    local env=$1
    local build_cmd=$2
    local env_name=$3
    
    echo ""
    echo "================================================"
    info "開始建構 $env_name 環境"
    echo "================================================"
    
    # 檢查配置文件
    if ! check_env_file "$env"; then
        return 1
    fi
    
    # 顯示配置信息
    info "配置文件: .env.$env"
    if grep -q "REACT_APP_API_URL" "$CLIENT_DIR/.env.$env"; then
        API_URL=$(grep "REACT_APP_API_URL" "$CLIENT_DIR/.env.$env" | cut -d'=' -f2)
        info "API URL: $API_URL"
    fi
    
    # 進入客戶端目錄
    cd "$CLIENT_DIR"
    
    # 執行建構
    info "執行建構命令: npm run $build_cmd"
    npm run "$build_cmd"
    
    if [ $? -eq 0 ]; then
        success "建構成功！"
        
        # 計算大小
        BUILD_SIZE=$(du -sh build | cut -f1)
        info "建構大小: $BUILD_SIZE"
        
        # 移動建構產物到輸出目錄
        mkdir -p "../$BUILD_OUTPUT_DIR"
        OUTPUT_PATH="../$BUILD_OUTPUT_DIR/build-${env}-${TIMESTAMP}"
        
        cp -r build "$OUTPUT_PATH"
        success "建構產物已保存到: $OUTPUT_PATH"
        
        # 創建壓縮包
        cd "../$BUILD_OUTPUT_DIR"
        tar -czf "build-${env}-${TIMESTAMP}.tar.gz" "build-${env}-${TIMESTAMP}"
        ARCHIVE_SIZE=$(du -h "build-${env}-${TIMESTAMP}.tar.gz" | cut -f1)
        success "壓縮包已創建: build-${env}-${TIMESTAMP}.tar.gz ($ARCHIVE_SIZE)"
        
        cd - > /dev/null
    else
        error "建構失敗"
        cd - > /dev/null
        return 1
    fi
    
    cd ..
}

# 主程序
main() {
    # 檢查是否在正確的目錄
    if [ ! -d "$CLIENT_DIR" ]; then
        error "找不到 client 目錄"
        exit 1
    fi
    
    # 檢查 npm 是否安裝
    if ! command -v npm &> /dev/null; then
        error "未安裝 npm"
        exit 1
    fi
    
    # 檢查依賴是否安裝
    if [ ! -d "$CLIENT_DIR/node_modules" ]; then
        warning "未找到 node_modules，正在安裝依賴..."
        cd "$CLIENT_DIR"
        npm install
        cd ..
    fi
    
    # 解析參數
    ENV_TO_BUILD=${1:-""}
    
    if [ -z "$ENV_TO_BUILD" ]; then
        show_help
        exit 0
    fi
    
    echo "🚀 Picklevibes 多環境建構工具"
    echo "時間: $(date)"
    echo ""
    
    case "$ENV_TO_BUILD" in
        dev|development)
            build_env "development" "build:dev" "開發"
            ;;
        uat)
            build_env "uat" "build:uat" "UAT"
            ;;
        staging)
            build_env "staging" "build:staging" "Staging"
            ;;
        prod|production)
            build_env "production" "build:production" "生產"
            ;;
        all)
            build_env "development" "build:dev" "開發"
            build_env "uat" "build:uat" "UAT"
            build_env "staging" "build:staging" "Staging"
            build_env "production" "build:production" "生產"
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            error "無效的環境: $ENV_TO_BUILD"
            show_help
            exit 1
            ;;
    esac
    
    # 最終總結
    echo ""
    echo "================================================"
    success "建構完成！"
    echo "================================================"
    echo ""
    info "建構產物位置: $BUILD_OUTPUT_DIR/"
    echo ""
    info "上傳到服務器:"
    echo "  scp $BUILD_OUTPUT_DIR/build-*.tar.gz user@server:/path/"
    echo ""
    info "在服務器上解壓並部署:"
    echo "  tar -xzf build-*.tar.gz"
    echo "  rm -rf /var/www/app/build"
    echo "  mv build-*-*/ /var/www/app/build"
    echo ""
}

# 執行主程序
main "$@"


#!/bin/bash

# Immich Kubernetes 部署腳本
# 用於部署 Immich 到 Kubernetes 集群

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：顯示使用說明
show_usage() {
    echo -e "${BLUE}Immich Kubernetes 部署工具${NC}"
    echo ""
    echo "用法: $0 [選項]"
    echo ""
    echo "選項:"
    echo "  -d, --deploy          部署 Immich"
    echo "  -s, --status          查看部署狀態"
    echo "  -l, --logs            查看日誌"
    echo "  -c, --cleanup         清理部署"
    echo "  -h, --help            顯示此幫助信息"
    echo ""
    echo "範例:"
    echo "  $0 -d                 # 部署 Immich"
    echo "  $0 -s                 # 查看狀態"
    echo "  $0 -l                 # 查看日誌"
    echo "  $0 -c                 # 清理部署"
}

# 函數：檢查前置條件
check_prerequisites() {
    echo -e "${BLUE}檢查前置條件...${NC}"

    # 檢查 kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}錯誤: kubectl 未安裝或不在 PATH 中${NC}"
        exit 1
    fi

    # 檢查是否連接到 Kubernetes 集群
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}錯誤: 無法連接到 Kubernetes 集群${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ 前置條件檢查通過${NC}"
}

# 函數：部署 Immich
deploy_immich() {
    echo -e "${BLUE}開始部署 Immich...${NC}"

    # 創建 namespace
    echo -e "${YELLOW}創建 immich namespace...${NC}"
    kubectl create namespace immich --dry-run=client -o yaml | kubectl apply -f -

    # 1Password Operator → Secret immich-postgresql-credentials（vault 須已有 Immich-PostgreSQL item）
    echo -e "${YELLOW}部署 OnePasswordItem...${NC}"
    kubectl apply -f 1password-items.yaml
    echo -e "${YELLOW}等待 Operator 同步 Secret（最多約 60s）...${NC}"
    for _ in $(seq 1 30); do
        if kubectl get secret immich-postgresql-credentials -n immich &>/dev/null; then
            echo -e "${GREEN}✅ Secret immich-postgresql-credentials 已就緒${NC}"
            break
        fi
        sleep 2
    done
    if ! kubectl get secret immich-postgresql-credentials -n immich &>/dev/null; then
        echo -e "${RED}錯誤: 未見 secret immich-postgresql-credentials；請確認 1Password Connect/Operator 與 vault item Immich-PostgreSQL${NC}"
        exit 1
    fi

    # MetalLB 專用 pool（須先於 LoadBalancer）
    echo -e "${YELLOW}部署 MetalLB immich-pool...${NC}"
    kubectl apply -f metallb-immich-pool.yaml

    # 部署 PVC
    echo -e "${YELLOW}部署 PVC...${NC}"
    kubectl apply -f immich-local-pv.yaml

    # 部署 ConfigMap
    echo -e "${YELLOW}部署 ConfigMap...${NC}"
    kubectl apply -f immich-configmap.yaml

    # 部署 Deployments + ClusterIP Services
    echo -e "${YELLOW}部署 Deployments / Services...${NC}"
    kubectl apply -f immich-deployment.yaml

    # 部署 LoadBalancer（與 immich-deployment 分檔，避免漂移）
    echo -e "${YELLOW}部署 LoadBalancer...${NC}"
    kubectl apply -f immich-loadbalancer.yaml

    # 選用：Ingress + cert-manager（與 wg Caddy 同 host 二擇一，見 immich-ingress.yaml 註解）
    echo -e "${YELLOW}部署 Ingress（可選）...${NC}"
    kubectl apply -f immich-ingress.yaml

    echo -e "${GREEN}✅ Immich 部署完成${NC}"
    echo -e "${BLUE}LoadBalancer IP: 192.168.50.156（須與 immich-pool 一致）${NC}"
    echo -e "${BLUE}對外（Caddy 路徑）: https://immich.3q.fi${NC}"
}

# 函數：查看狀態
show_status() {
    echo -e "${BLUE}Immich 部署狀態${NC}"
    echo "========================================"

    echo -e "\n${YELLOW}Namespace:${NC}"
    kubectl get namespace immich

    echo -e "\n${YELLOW}Deployments:${NC}"
    kubectl get deployments -n immich

    echo -e "\n${YELLOW}Services:${NC}"
    kubectl get services -n immich

    echo -e "\n${YELLOW}Pods:${NC}"
    kubectl get pods -n immich

    echo -e "\n${YELLOW}LoadBalancer 狀態:${NC}"
    kubectl get service immich-loadbalancer -n immich
}

# 函數：查看日誌
show_logs() {
    echo -e "${BLUE}Immich 日誌${NC}"
    echo "========================================"

    echo -e "\n${YELLOW}immich-server 日誌:${NC}"
    kubectl logs -n immich deployment/immich-server --tail=20
}

# 函數：清理部署
cleanup_immich() {
    echo -e "${YELLOW}清理 Immich 部署...${NC}"

    kubectl delete -f immich-ingress.yaml --ignore-not-found=true
    kubectl delete -f immich-loadbalancer.yaml --ignore-not-found=true
    kubectl delete -f immich-deployment.yaml --ignore-not-found=true
    kubectl delete -f immich-configmap.yaml --ignore-not-found=true

    # 刪除 PVC (可選，會刪除數據)
    read -p "是否刪除 PVC (會刪除所有數據)? [y/N]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete -f immich-local-pv.yaml --ignore-not-found=true
    fi

    kubectl delete -f 1password-items.yaml --ignore-not-found=true

    # 刪除 namespace
    kubectl delete namespace immich --ignore-not-found=true

    echo -e "${GREEN}✅ Immich 清理完成${NC}"
}

# 主邏輯
main() {
    local action=""

    # 解析命令行參數
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--deploy)
                action="deploy"
                shift
                ;;
            -s|--status)
                action="status"
                shift
                ;;
            -l|--logs)
                action="logs"
                shift
                ;;
            -c|--cleanup)
                action="cleanup"
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                echo -e "${RED}錯誤: 未知參數 $1${NC}"
                show_usage
                exit 1
                ;;
        esac
    done

    if [[ -z "$action" ]]; then
        show_usage
        exit 1
    fi

    check_prerequisites

    case $action in
        "deploy")
            deploy_immich
            ;;
        "status")
            show_status
            ;;
        "logs")
            show_logs
            ;;
        "cleanup")
            cleanup_immich
            ;;
    esac
}

# 執行主函數
main "$@"

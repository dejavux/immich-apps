# GPU 配置說明

**更新日期**: 2026-05-27
**維護者**: Infrastructure Team

---

## 📊 GPU 資源總覽

### 集群 GPU 配置

| Node | Total GPU | Model | Used | Available | 備註 |
|------|-----------|-------|------|-----------|------|
| **lama** | 4 | NVIDIA | 1 | 3 | qwen-coder (1 GPU) |
| **worker3** | 4 | NVIDIA | 1 | 3 | immich-machine-learning (1 GPU) |
| alpha | 0 | - | - | - | 無 GPU |
| worker1-9 | 0 | - | - | - | 無 GPU |

**總計**: 8 個 GPU，使用 2 個，可用 6 個

---

## 🔍 當前 GPU 使用狀況

### 1. qwen-coder (lama)

**Namespace**: `local-llm`
**Pod**: `qwen-coder-*`
**Node**: lama
**GPU 使用**: 1/4

```yaml
# qwen-coder-deployment.yaml
nodeSelector:
  kubernetes.io/hostname: lama
  nvidia.com/gpu: "true"
resources:
  requests:
    nvidia.com/gpu: 1
    memory: "12Gi"
  limits:
    nvidia.com/gpu: 1
    memory: "20Gi"
```

**用途**: Qwen Coder LLM 推理服務

---

### 2. immich-machine-learning (worker3)

**Namespace**: `immich`
**Pod**: `immich-machine-learning-*`
**Node**: worker3
**GPU 使用**: 1/4

```yaml
# immich-deployment.yaml
nodeSelector:
  kubernetes.io/hostname: worker3
  nvidia.com/gpu: "true"
resources:
  requests:
    nvidia.com/gpu: 1
    memory: "4Gi"
  limits:
    nvidia.com/gpu: 1
    memory: "8Gi"
```

**用途**:

- CLIP 物件辨識
- 人臉識別
- 場景分類

---

## ✅ GPU 配置驗證

### 檢查命令

```bash
# 1. 查看節點 GPU 容量
kubectl get nodes -o custom-columns=NAME:.metadata.name,GPU:.status.capacity.'nvidia\.com/gpu'

# 輸出:
# NAME      GPU
# lama      4
# worker3   4

# 2. 查看 GPU Pod 分佈
kubectl get pods -A -o wide | grep -E "qwen|immich-machine-learning"

# 輸出:
# local-llm   qwen-coder-*                1/1   Running   0   12d   10.244.3.141   lama
# immich      immich-machine-learning-*   1/1   Running   0   21d   10.244.6.95    worker3

# 3. 檢查 nvidia-device-plugin
kubectl get pods -n kube-system | grep nvidia-device-plugin

# 輸出:
# nvidia-device-plugin-daemonset-mxvnw   1/1   Running   0   36d
# nvidia-device-plugin-daemonset-t6x52   1/1   Running   1   12d
```

---

## 🎯 GPU 分配策略

### 設計原則

1. **隔離原則**: 不同服務分配到不同節點，避免資源競爭
2. **容錯原則**: 兩個節點都有 GPU，互為備援
3. **擴展原則**: 每節點還有 3 個 GPU 可用

### 當前分配

```yaml
lama (4 GPU):
  ├── qwen-coder: 1 GPU (LLM 推理)
  └── 可用: 3 GPU

worker3 (4 GPU):
  ├── immich-machine-learning: 1 GPU (照片 ML)
  └── 可用: 3 GPU
```

### 為什麼這樣分配？

**問題**: lama 的 GPU 不是都給 qwen 了嗎？
**答案**: ❌ 否

- lama 有 **4 個 GPU**
- qwen 只用 **1 個 GPU**
- 還有 **3 個 GPU** 可用

**Immich ML 為什麼在 worker3？**

- 設計選擇：**隔離不同服務**
- qwen (LLM 推理) 和 immich (照片 ML) 分開
- 避免資源競爭，提升穩定性

---

## 🔧 GPU 配置調整

### 選項 1: Immich ML 移到 lama（可行但不建議）

```yaml
# immich-deployment.yaml
nodeSelector:
  kubernetes.io/hostname: lama  # 改為 lama
  nvidia.com/gpu: "true"
```

**優點**:

- 與 immich-server / postgres 同節點，減少網絡延遲

**缺點**:

- 與 qwen 共享節點，可能資源競爭
- worker3 GPU 閒置

---

### 選項 2: 保持當前配置（推薦）✅

**理由**:

1. **隔離性**: qwen (lama) 和 immich ML (worker3) 分開
2. **擴展性**: 兩節點都有空餘 GPU
3. **穩定性**: 避免單節點故障影響所有 GPU 服務

---

## 📈 GPU 使用監控

### Prometheus 指標

```promql
# GPU 使用率
DCGM_FI_DEV_GPU_UTIL{kubernetes_node="lama"}
DCGM_FI_DEV_GPU_UTIL{kubernetes_node="worker3"}

# GPU 記憶體使用
DCGM_FI_DEV_FB_USED{kubernetes_node="lama"}
DCGM_FI_DEV_FB_USED{kubernetes_node="worker3"}

# Pod GPU 請求
kube_pod_container_resource_requests{resource="nvidia_com_gpu"}
```

### 查看 GPU 使用

```bash
# 在節點上執行
ssh lama "nvidia-smi"
ssh worker3 "nvidia-smi"

# 或在 GPU Pod 內執行
kubectl exec -n immich deployment/immich-machine-learning -- nvidia-smi
kubectl exec -n local-llm deployment/qwen-coder -- nvidia-smi
```

---

## 🚀 未來 GPU 擴展

### 可能的新服務

| 服務 | GPU 需求 | 建議節點 | 原因 |
|------|----------|----------|------|
| **Immich 額外 ML** | 1 GPU | lama | 利用空餘 GPU |
| **Stable Diffusion** | 1-2 GPU | lama 或 worker3 | 兩節點都可 |
| **Whisper (語音)** | 1 GPU | lama | 與 qwen 相關 |
| **ComfyUI** | 1 GPU | worker3 | 圖像處理 |

### 容量規劃

```yaml
當前容量: 8 GPU
當前使用: 2 GPU (25%)
可用容量: 6 GPU (75%)

建議閾值:
  - 綠燈: < 50% (< 4 GPU)
  - 黃燈: 50-75% (4-6 GPU)
  - 紅燈: > 75% (> 6 GPU)

目前狀態: 🟢 綠燈（25% 使用率）
```

---

## ⚠️ 注意事項

### GPU 親和性

1. **不要在 deployment 中硬編碼節點名稱**（除非有充分理由）
2. **優先使用 nodeSelector + tolerations**
3. **考慮使用 nodeAffinity** 允許多節點

### 示例：靈活的 GPU 配置

```yaml
# 推薦: 允許在任何有 GPU 的節點運行
nodeSelector:
  nvidia.com/gpu: "true"  # ✅ 靈活

# 避免: 硬編碼節點名稱
nodeSelector:
  kubernetes.io/hostname: worker3  # ⚠️ 不靈活

# 更好的方式: nodeAffinity
affinity:
  nodeAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: kubernetes.io/hostname
              operator: In
              values: ["worker3", "lama"]  # 首選這兩個節點
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: nvidia.com/gpu
              operator: Exists  # 但任何有 GPU 的節點都可以
```

---

## 📚 相關文檔

- [Kubernetes Device Plugins](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/device-plugins/)
- [NVIDIA Device Plugin](https://github.com/NVIDIA/k8s-device-plugin)
- [Immich GPU Acceleration](https://docs.immich.app/features/ml-hardware-acceleration)

---

## 🔍 故障排查

### GPU Pod Pending

```bash
# 檢查 Pod 事件
kubectl describe pod -n immich <pod-name>

# 常見原因:
# 1. 沒有可用 GPU: "0/X nodes are available: insufficient nvidia.com/gpu"
# 2. NodeSelector 不匹配: "0/X nodes are available: node(s) didn't match Pod's node affinity"
# 3. Toleration 缺失: "0/X nodes are available: node(s) had untolerated taint"

# 解決方案:
# 1. 檢查 GPU 容量: kubectl get nodes -o custom-columns=...
# 2. 檢查節點標籤: kubectl get nodes --show-labels | grep gpu
# 3. 檢查 nvidia-device-plugin: kubectl get pods -n kube-system | grep nvidia
```

### GPU 未被識別

```bash
# 檢查 nvidia-device-plugin
kubectl logs -n kube-system -l name=nvidia-device-plugin-ds

# 在節點上檢查
ssh <node> "nvidia-smi"

# 檢查驅動
ssh <node> "cat /proc/driver/nvidia/version"
```

---

**總結**: lama 和 worker3 各有 4 個 GPU，當前僅各使用 1 個，資源充足且配置合理。

**最後更新**: 2026-05-27
**維護者**: Infrastructure Team

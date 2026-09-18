# 📘 Complete Java & Spring Boot Interview Guide (1-2 Years Experience)
### *Tailored with Real-World Healthcare ePCR & RazorpayX Payout Project Architecture*

---

## 📑 Table of Contents
1. **Core Java (Java 8 - 21)**
2. **Collections & Multithreading**
3. **Spring Boot Core & Dependency Injection**
4. **Spring Security & Multi-Tenancy Architecture**
5. **MongoDB, Database Indexing & Optimistic Locking**
6. **Design Patterns Used in the Project**
7. **RazorpayX Automated Payout & Webhook Integration (Project Deep-Dive)**
8. **Top Scenario-Based Interview Questions**

---

## ☕ 1. Core Java (Java 8 - 21)

### Q1: What are Java 8 Streams? How are they used in processing financial/billing records?
**Answer:**
Java 8 Streams represent a sequence of elements supporting sequential and parallel aggregate operations. Unlike collections, streams do not store data; they operate on data structures on demand.

**Code Example from Project:**
```java
// Filtering active doctor payment accounts and collecting to list
List<DoctorPaymentAccount> activeDocAccounts = docAccounts.stream()
    .filter(acc -> Boolean.TRUE.equals(acc.getActive()))
    .collect(Collectors.toList());
```
* Key Stream Methods: `filter()`, `map()`, `flatMap()`, `reduce()`, `collect()`, `findFirst()`.
* Intermediate vs Terminal Operations: Intermediate operations (`filter`, `map`) are lazy; terminal operations (`collect`, `count`) trigger processing.

---

### Q2: What is the difference between Checked and Unchecked Exceptions in Java?
**Answer:**
* **Checked Exceptions** (e.g., `IOException`, `SQLException`): Must be either declared in `throws` clause or handled in a `try-catch` block at compile time.
* **Unchecked Exceptions** (e.g., `NullPointerException`, `AccessDeniedException`, `IllegalArgumentException`): Extend `RuntimeException`. Handled dynamically at runtime.

**Project Context:**
In Spring Boot REST APIs, we use **Unchecked Exceptions** so that Spring's `@ControllerAdvice` can intercept them globally and convert them into clean HTTP JSON responses (e.g., `403 Forbidden` or `404 Not Found`).

---

### Q3: What are Java 17/21 Records, and how do they differ from Lombok `@Data` / `@Value`?
**Answer:**
* **Java Records**: Immutable data carrier classes defined with `public record Point(int x, int y) {}`. Auto-generates `equals()`, `hashCode()`, `toString()`, and getter-like accessor methods (`x()`, `y()`). Fields are `final`.
* **Lombok `@Data`**: Mutable POJO class generator (`getters`, `setters`, `equals`, `hashCode`, `toString`).

---

## 🧵 2. Collections & Multithreading

### Q4: Compare `HashMap` vs `ConcurrentHashMap`. How does `ConcurrentHashMap` achieve thread safety?
**Answer:**
* `HashMap`: Non-thread-safe. Allows 1 `null` key and multiple `null` values. Concurrent writes can cause race conditions or corrupt memory.
* `ConcurrentHashMap`: Thread-safe. Does **NOT** allow `null` keys or values.
  * **Java 7**: Used Segment Locking (Locking a portion of the map).
  * **Java 8+**: Uses Bucket-level Synchronization (Locks only the first node of a bucket during insertion) and CAS (Compare-And-Swap) operations for read/write efficiency.

---

### Q5: What is `ThreadLocal`? Why is it critical for Multi-Tenant Isolation?
**Answer:**
`ThreadLocal` creates variables that can only be read and written by the specific thread executing the code.

**Project Implementation (`TenantContext.java`):**
```java
public class TenantContext {
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setCurrentOrganizationId(String orgId) {
        CURRENT_TENANT.set(orgId);
    }

    public static String currentOrganizationId() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove(); // CRITICAL: Prevents memory leaks in thread pools
    }
}
```
* **Why `.remove()` is mandatory**: Tomcat web server reuses threads from a thread pool. If `.remove()` is not called in a `finally` block or filter, tenant information leaks to subsequent HTTP requests handled by the same thread.

---

## 🍃 3. Spring Boot Core & Dependency Injection

### Q6: Explain Dependency Injection (DI) and Inversion of Control (IoC).
**Answer:**
* **IoC**: Paradigm where the Spring Container manages object lifecycle, instantiation, and wiring instead of developer doing `new MyService()`.
* **DI**: Design pattern where dependencies are provided to a class:
  1. **Constructor Injection** *(Best Practice)*: Guarantees mandatory dependencies exist at compile-time and allows `final` fields.
  2. **Setter Injection**: Useful for optional dependencies.
  3. **Field Injection (`@Autowired`)**: Not recommended for core logic due to testing/mocking difficulty.

---

### Q7: What are Spring Bean Scopes?
**Answer:**
1. **Singleton** *(Default)*: Single instance per Spring IoC container context.
2. **Prototype**: New instance created every time requested.
3. **Request**: Single instance per HTTP request lifecycle.
4. **Session**: Single instance per HTTP session.

---

### Q8: How does Global Exception Handling work using `@ControllerAdvice`?
**Answer:**
`@RestControllerAdvice` consolidates exception handling across all `@RestController` components into a single centralized component.

**Code Example:**
```java
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
            "timestamp", LocalDateTime.now(),
            "status", 403,
            "error", "Forbidden",
            "message", ex.getMessage()
        ));
    }
}
```

---

## 🔒 4. Spring Security & Multi-Tenancy Architecture

### Q9: What is Fail-Closed Security Authorization? How did you implement it?
**Answer:**
**Fail-Closed Security** means if any authorization condition or context is missing, access is denied by default (Fail Safe).

**Project Implementation (`OrgPaymentGatewayService.java`):**
```java
public Map<String, Object> triggerInstantPayout(String accountId, String claimNumber) {
    String currentOrg = TenantContext.currentOrganizationId();
    boolean isPlatformAdmin = TenantContext.hasRole("ADMIN");

    DoctorPaymentAccount account = doctorPaymentAccountRepository.findById(accountId)
            .orElseThrow(() -> new ResourceNotFoundException("Doctor account not found"));

    // FAIL-CLOSED CHECK: If tenant is missing AND not admin -> DENY IMMEDIATELY
    if (!isPlatformAdmin && (currentOrg == null || !currentOrg.equals(account.getOrganizationId()))) {
        throw new AccessDeniedException("Access denied to doctor account");
    }

    // Proceed to payout...
}
```

---

### Q10: How does Method Security (`@PreAuthorize`) work under the hood?
**Answer:**
Spring Security uses Spring AOP proxies. When a method annotated with `@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")` is called, the proxy intercepts execution, retrieves the current `SecurityContext` from `SecurityContextHolder`, evaluates the SpEL expression, and either permits execution or throws `AccessDeniedException`.

---

## 💾 5. MongoDB, Database Indexing & Optimistic Locking

### Q11: What is Optimistic Locking (`@Version`), and how does it prevent race conditions?
**Answer:**
Optimistic Locking assumes multiple concurrent transactions will rarely conflict. Each document maintains a `@Version` field.

**Code Example (`Claim.java`):**
```java
@Document(collection = "claims")
public class Claim {
    @Id
    private String id;
    
    private ClaimStatus status;

    @Version
    private Long version; // Managed automatically by Spring Data Mongo
}
```
* **Execution Flow:**
  1. Thread A reads Claim (Version 1).
  2. Thread B reads Claim (Version 1).
  3. Thread A updates status to `PAID` (Version incremented to 2).
  4. Thread B attempts to update status to `REJECTED` checking `Version == 1` $\rightarrow$ Fails with `OptimisticLockingFailureException`.

---

### Q12: Why do we use Compound Indexes in MongoDB?
**Answer:**
Single field indexes are insufficient when queries filter on multiple fields simultaneously (e.g., `organizationId` + `doctorUserId`).

**Code Example (`DoctorPaymentAccount.java`):**
```java
@CompoundIndex(name = "org_doctor_idx", def = "{'organizationId': 1, 'doctorUserId': 1}", unique = true)
```
* **Benefit**: Reduces query execution time from $O(N)$ (Collection Scan) to $O(\log N)$ (Index B-Tree Lookup) and enforces unique doctor payout account per organization.

---

## 🏗️ 6. Design Patterns Used in the Project

| Pattern | Where Used | Purpose |
| :--- | :--- | :--- |
| **Builder Pattern** | `@Builder` in Models DTOs | Constructs immutable/complex objects cleanly. |
| **Idempotency Pattern** | `DoctorPayoutTransactionRepository` | Prevents duplicate payments/transfers on network retries. |
| **Strategy Pattern** | Payment Gateway Service | Switch between Live RazorpayX API and Simulated Payout Mode. |
| **Singleton Pattern** | Spring `@Service` & `@Repository` Beans | Single shared service instance throughout app lifecycle. |

---

## ⚡ 7. RazorpayX Automated Payout & Webhook Integration (Project Deep-Dive)

### Q13: Explain how the Webhook Callback auto-triggers Instant Doctor Payouts.
**Answer:**
1. **Event Capture**: Patient pays via Razorpay. Razorpay servers fire an HTTP POST webhook (`payment.captured`) to `/api/billing/razorpay/webhook`.
2. **Signature Verification**: Webhook controller verifies the `X-Razorpay-Signature` header using HMAC SHA-256 with secret key.
3. **Claim Settlement**: `ClaimService.payClaimViaWebhook()` marks the claim status as `PAID`.
4. **Automated Payout Trigger**:
   ```java
   // In ClaimService.java (inside sendDoctorCommissionEmail)
   if (claim.getDoctorUserId() != null) {
       var docAccOpt = doctorPaymentAccountRepository.findByOrganizationIdAndDoctorUserId(orgId, claim.getDoctorUserId());
       if (docAccOpt.isPresent()) {
           orgPaymentGatewayService.triggerInstantPayout(docAccOpt.get().getId(), claim.getClaimNumber());
       }
   }
   ```
5. **Instant Transfer**: `OrgPaymentGatewayService` calculates server-side commission amount, verifies idempotency, calls RazorpayX UPI Payout API, logs transaction audit record in `DoctorPayoutTransaction`, and emails receipt.

---

### Q14: How do you prevent financial fraud in commission calculation?
**Answer:**
* **Server-Side Truth**: We NEVER accept payout amounts from client HTTP payloads. The client only sends `claimNumber`.
* **Database Calculation**:
  ```java
  BigDecimal totalBill = claim.getPatientResponsibility();
  BigDecimal commRate = docAcc.getCommissionPercent();
  BigDecimal doctorShare = totalBill.multiply(commRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
  ```

---

## ❓ 8. Top Scenario-Based Interview Questions

### Scenario A: "What happens if RazorpayX API times out or fails midway?"
**Answer:**
Our system uses a two-phase audit status in `DoctorPayoutTransaction`:
1. Save transaction in `PROCESSING` status.
2. Trigger API call with `X-Payout-Idempotency` header (`organizationId + claimNumber + doctorAccountId`).
3. If API succeeds $\rightarrow$ Status updated to `PROCESSED`.
4. If API throws Exception/Timeout $\rightarrow$ Status updated to `FAILED` with error reason logged.
5. Future retry attempts check `DoctorPayoutTransaction`. If status is `PROCESSED`, retry is blocked. If `FAILED`, retry proceeds cleanly with identical idempotency key.

---

### Scenario B: "How do you ensure multi-tenant security when querying database records?"
**Answer:**
Every MongoDB query strictly incorporates `organizationId` obtained directly from `TenantContext.currentOrganizationId()` (derived from JWT token), avoiding unvalidated user parameters.

---

## 🎯 Interview Cheat Sheet (Summary of Key Strengths to Mention):
1. **Architecture**: Clean 3-tier REST architecture (Controller $\rightarrow$ Service $\rightarrow$ Repository).
2. **Security**: Multi-tenancy with `ThreadLocal`, Fail-closed authorization, SpEL `@PreAuthorize`.
3. **Financial Integrity**: Server-side calculation, Idempotency keys, Optimistic locking (`@Version`), and Audit log trail.
4. **Integration**: Webhooks with HMAC SHA256 verification and RazorpayX Instant UPI Payout APIs.

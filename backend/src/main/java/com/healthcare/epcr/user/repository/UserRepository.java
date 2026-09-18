package com.healthcare.epcr.user.repository;

import com.healthcare.epcr.user.model.Role;
import com.healthcare.epcr.user.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.util.List;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Page<User> findByOrganizationId(String organizationId, Pageable pageable);
    List<User> findByOrganizationId(String organizationId);
    List<User> findByRole(Role role);
    List<User> findByOrganizationIdAndRole(String organizationId, Role role);
}



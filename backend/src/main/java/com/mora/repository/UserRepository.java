package com.mora.repository;

import com.mora.entity.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    // 이메일 주소로 사용자 조회(존재하지 않으면 Optional.empty() 반환)
    Optional<User> findByEmail(String email);

    //해당 이메일로 가입된 사용자가 있는지 확인(회원가입 시 중복 검사용)
    boolean existsByEmail(String email);
}

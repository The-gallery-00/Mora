package com.mora;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MoraApplication {

    public static void main(String[] args) {
        // Spring Boot 애플리케이션 컨텍스트를 초기화하고 내장 톰캣을 기동한다
        SpringApplication.run(MoraApplication.class, args);
    }
}
